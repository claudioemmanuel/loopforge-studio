/**
 * Domain Event Publisher
 *
 * Publishes domain events to Redis Pub/Sub for inter-context communication.
 * Events are both published to Redis and persisted to the database.
 *
 * ## Reliability Guarantees
 *
 * Publication follows a two-phase approach with automatic retries:
 * 1. **Persist Phase**: Save event to database (audit trail)
 *    - 3 retries with exponential backoff (100ms, 200ms, 400ms)
 *    - On final failure, send to dead-letter queue and throw error
 * 2. **Publish Phase**: Broadcast to Redis Pub/Sub (delivery)
 *    - 3 retries with exponential backoff
 *    - On final failure, send to dead-letter queue and throw error
 *
 * ## Event Normalization
 *
 * All events are normalized to canonical format before publishing:
 * - Legacy format: "ExecutionCompleted" → Canonical: "Execution.Completed"
 * - Subscribers receive canonical format with compatibility layer
 * - See event-taxonomy.ts for format mapping
 *
 * ## Dead-Letter Queue
 *
 * Events that fail after exhausting retries are published to:
 * - Channel: "domain-events:dead-letter"
 * - Payload: { stage, event, error, timestamp }
 * - Allows monitoring and manual recovery
 */

import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { domainEvents } from "@/lib/db/schema/tables";
import type { DomainEvent, IEventPublisher } from "./types";
import { toCanonicalEventType } from "./event-taxonomy";

export class EventPublisher implements IEventPublisher {
  private static instance: EventPublisher;
  private redis: Redis;
  private readonly channelPrefix = "domain-events:";
  private readonly deadLetterChannel = "domain-events:dead-letter";
  private readonly maxRetries = 3;
  private readonly baseRetryDelayMs = 100;

  private constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get singleton instance of EventPublisher
   */
  static getInstance(redis: Redis): EventPublisher {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new EventPublisher(redis);
    }
    return EventPublisher.instance;
  }

  /**
   * Publish a single domain event
   */
  async publish(event: DomainEvent): Promise<void> {
    // Ensure event has required fields
    const enrichedEvent: DomainEvent = {
      ...event,
      id: event.id || randomUUID(),
      eventType: toCanonicalEventType(event.eventType, event.aggregateType),
      occurredAt: event.occurredAt || new Date(),
    };

    try {
      await this.withRetry(
        () => this.persistEvent(enrichedEvent),
        "persist",
        enrichedEvent,
      );
      await this.withRetry(
        () => this.publishToRedis(enrichedEvent),
        "publish",
        enrichedEvent,
      );
    } catch (error) {
      await this.publishDeadLetter(enrichedEvent, "publish_pipeline", error);
      throw error;
    }
  }

  /**
   * Publish multiple events in order
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Persist event to database
   */
  private async persistEvent(event: DomainEvent): Promise<void> {
    await db.insert(domainEvents).values({
      id: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.occurredAt,
      data: event.data,
      metadata: event.metadata || {},
      version: 1, // Schema version for future compatibility
    });
  }

  /**
   * Publish event to Redis Pub/Sub
   */
  private async publishToRedis(event: DomainEvent): Promise<void> {
    const channel = `${this.channelPrefix}${event.eventType}`;
    const message = JSON.stringify(event);

    // Publish to specific channel
    // Wildcard subscribers will receive this via psubscribe pattern matching
    await this.redis.publish(channel, message);
  }

  private async withRetry(
    fn: () => Promise<void>,
    stage: "persist" | "publish",
    event: DomainEvent,
  ): Promise<void> {
    let attempt = 1;
    while (attempt <= this.maxRetries) {
      try {
        await fn();
        return;
      } catch (error) {
        if (attempt === this.maxRetries) {
          await this.publishDeadLetter(event, stage, error);
          throw error;
        }

        const waitMs = this.baseRetryDelayMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        attempt++;
      }
    }
  }

  private async publishDeadLetter(
    event: DomainEvent,
    stage: string,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : "Unknown publish error";

    const payload = {
      stage,
      event,
      error: message,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.redis.publish(this.deadLetterChannel, JSON.stringify(payload));
    } catch (deadLetterError) {
      console.error(
        "Failed to publish event dead-letter:",
        deadLetterError instanceof Error
          ? deadLetterError.message
          : deadLetterError,
      );
    }
  }

  /**
   * Create a domain event with standard fields
   */
  static createEvent<T extends Record<string, unknown>>(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    data: T,
    metadata?: DomainEvent["metadata"],
  ): DomainEvent {
    return {
      id: randomUUID(),
      eventType,
      aggregateId,
      aggregateType,
      occurredAt: new Date(),
      data,
      metadata,
    };
  }
}
