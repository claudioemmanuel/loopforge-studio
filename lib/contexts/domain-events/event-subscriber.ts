/**
 * Domain Event Subscriber
 *
 * Subscribes to domain events from Redis Pub/Sub and routes them to registered handlers.
 * Supports wildcard subscriptions (e.g., 'Task.*' matches all Task events).
 */

import { Redis } from "ioredis";
import type { DomainEvent, EventSubscription, IEventSubscriber } from "./types";

export class EventSubscriber implements IEventSubscriber {
  private static instance: EventSubscriber;
  private redis: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private readonly channelPrefix = "domain-events:";
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

    await this.subscriber.punsubscribe();
    await this.subscriber.quit();

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
      try {
        await subscription.handler(event);
      } catch (error) {
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

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      if (this.matchesPattern(eventType, pattern)) {
        matching.push(...subscriptions);
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

  /**
   * Get all registered subscriptions (for debugging)
   */
  getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }
}
