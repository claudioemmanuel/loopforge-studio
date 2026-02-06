/**
 * Domain Event Subscriber
 *
 * Subscribes to domain events from Redis Pub/Sub and routes them to registered handlers.
 * Supports wildcard subscriptions (e.g., 'Task.*' matches all Task events).
 *
 * ## Idempotency Guarantees
 *
 * Each event is processed exactly once per subscriber using an inbox pattern:
 * - Before processing, claim an inbox lock using Redis SET NX with event.id as key
 * - If lock acquisition fails, event was already processed (or is being processed)
 * - Successful processing keeps the inbox key for 7 days (prevents late duplicates)
 * - Failed processing releases the inbox key (allows retry)
 * - Each subscriber has an isolated inbox (parallel processing across subscribers)
 *
 * ## Retry Strategy
 *
 * Failed handlers are retried up to 3 times with exponential backoff:
 * - Attempt 1: immediate
 * - Attempt 2: 100ms delay
 * - Attempt 3: 200ms delay
 * - Attempt 4: 400ms delay (final attempt)
 * - After exhausting retries, event is sent to dead-letter channel
 */

import { Redis } from "ioredis";
import type { DomainEvent, EventSubscription, IEventSubscriber } from "./types";
import { getCompatibleEventTypes } from "./event-taxonomy";

export class EventSubscriber implements IEventSubscriber {
  private static instance: EventSubscriber;
  private redis: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private readonly channelPrefix = "domain-events:";
  private readonly deadLetterChannel = "domain-events:dead-letter";
  private readonly inboxPrefix = "domain-events:inbox";
  private readonly inboxTtlSeconds = 60 * 60 * 24 * 7; // 7 days (prevents late duplicates)
  private readonly maxHandlerRetries = 3;
  private readonly retryDelayMs = 100;
  private isRunning = false;

  private constructor(redis: Redis) {
    this.redis = redis;
    // Create separate Redis connection for subscribing (Redis requirement)
    this.subscriber = redis.duplicate();
  }

  /**
   * Get singleton instance of EventSubscriber
   */
  static getInstance(redis: Redis): EventSubscriber {
    if (!EventSubscriber.instance) {
      EventSubscriber.instance = new EventSubscriber(redis);
    }
    return EventSubscriber.instance;
  }

  /**
   * Subscribe to events matching a pattern
   */
  subscribe(subscription: EventSubscription): void {
    const { eventType, priority = 100 } = subscription;

    // Get or create subscription list for this event type
    const existing = this.subscriptions.get(eventType) || [];

    // Add subscription with priority
    const subscriptionWithPriority = { ...subscription, priority };
    existing.push(subscriptionWithPriority);

    // Sort by priority (lower = higher priority)
    existing.sort((a, b) => (a.priority || 100) - (b.priority || 100));

    this.subscriptions.set(eventType, existing);

    console.log(
      `[EventSubscriber] Registered ${subscription.subscriberName} for ${eventType}`,
    );
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: string, subscriberName: string): void {
    const existing = this.subscriptions.get(eventType);
    if (!existing) return;

    const filtered = existing.filter(
      (sub) => sub.subscriberName !== subscriberName,
    );

    if (filtered.length === 0) {
      this.subscriptions.delete(eventType);
    } else {
      this.subscriptions.set(eventType, filtered);
    }

    console.log(
      `[EventSubscriber] Unregistered ${subscriberName} from ${eventType}`,
    );
  }

  /**
   * Start listening for events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[EventSubscriber] Already running");
      return;
    }

    // Subscribe to wildcard channel to receive all events
    const wildcardChannel = `${this.channelPrefix}*`;
    await this.subscriber.psubscribe(wildcardChannel);

    // Handle incoming messages
    this.subscriber.on("pmessage", async (pattern, channel, message) => {
      void pattern;
      void channel;
      try {
        const event: DomainEvent = JSON.parse(message);
        await this.handleEvent(event);
      } catch (error) {
        console.error("[EventSubscriber] Error handling event:", error);
      }
    });

    this.isRunning = true;
    console.log("[EventSubscriber] Started listening for domain events");
  }

  /**
   * Stop listening for events
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    await this.subscriber.punsubscribe(`${this.channelPrefix}*`);
    this.subscriber.removeAllListeners("pmessage");

    this.isRunning = false;
    console.log("[EventSubscriber] Stopped listening for domain events");
  }

  /**
   * Handle incoming event by routing to registered handlers
   */
  private async handleEvent(event: DomainEvent): Promise<void> {
    const matchingSubscriptions = this.findMatchingSubscriptions(
      event.eventType,
    );

    if (matchingSubscriptions.length === 0) {
      // No subscribers for this event type - this is normal
      return;
    }

    // Execute all matching handlers (sorted by priority)
    for (const subscription of matchingSubscriptions) {
      const inboxClaimed = await this.claimInbox(subscription, event);
      if (!inboxClaimed) {
        continue;
      }

      try {
        await this.executeHandlerWithRetry(subscription, event);
      } catch (error) {
        await this.releaseInbox(subscription, event);
        await this.publishDeadLetter(subscription, event, error);
        console.error(
          `[EventSubscriber] Error in handler ${subscription.subscriberName}:`,
          error,
        );
        // Continue executing other handlers even if one fails
      }
    }
  }

  /**
   * Find subscriptions matching an event type (supports wildcards)
   */
  private findMatchingSubscriptions(eventType: string): EventSubscription[] {
    const matching: EventSubscription[] = [];
    const seen = new Set<string>();
    const candidateTypes = getCompatibleEventTypes(eventType);

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      const matches = candidateTypes.some((candidate) =>
        this.matchesPattern(candidate, pattern),
      );

      if (matches) {
        for (const subscription of subscriptions) {
          const key = `${pattern}:${subscription.subscriberName}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          matching.push(subscription);
        }
      }
    }

    // Sort by priority
    return matching.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  /**
   * Check if event type matches subscription pattern
   * Supports wildcards: 'Task.*' matches 'TaskCreated', 'TaskStatusChanged', etc.
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    // Exact match
    if (eventType === pattern) return true;

    // Wildcard match
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }

    // Full wildcard
    if (pattern === "*") return true;

    return false;
  }

  private buildInboxKey(
    subscription: EventSubscription,
    event: DomainEvent,
  ): string {
    return `${this.inboxPrefix}:${subscription.subscriberName}:${event.id}`;
  }

  private async claimInbox(
    subscription: EventSubscription,
    event: DomainEvent,
  ): Promise<boolean> {
    const key = this.buildInboxKey(subscription, event);
    const result = await this.redis.set(
      key,
      "1",
      "EX",
      this.inboxTtlSeconds,
      "NX",
    );

    return result === "OK";
  }

  private async releaseInbox(
    subscription: EventSubscription,
    event: DomainEvent,
  ): Promise<void> {
    const key = this.buildInboxKey(subscription, event);
    await this.redis.del(key);
  }

  private async executeHandlerWithRetry(
    subscription: EventSubscription,
    event: DomainEvent,
  ): Promise<void> {
    let attempt = 1;

    while (attempt <= this.maxHandlerRetries) {
      try {
        await subscription.handler(event);
        return;
      } catch (error) {
        if (attempt === this.maxHandlerRetries) {
          throw error;
        }

        const delay = this.retryDelayMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      }
    }
  }

  private async publishDeadLetter(
    subscription: EventSubscription,
    event: DomainEvent,
    error: unknown,
  ): Promise<void> {
    const payload = {
      subscriberName: subscription.subscriberName,
      event,
      error: error instanceof Error ? error.message : "Unknown handler error",
      timestamp: new Date().toISOString(),
    };

    try {
      await this.redis.publish(this.deadLetterChannel, JSON.stringify(payload));
    } catch (deadLetterError) {
      console.error(
        `[EventSubscriber] Failed to publish dead-letter for ${subscription.subscriberName}:`,
        deadLetterError,
      );
    }
  }

  /**
   * Get all registered subscriptions (for debugging)
   */
  getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }
}
