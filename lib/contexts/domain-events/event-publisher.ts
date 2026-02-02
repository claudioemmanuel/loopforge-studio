/**
 * Domain Event Publisher
 *
 * Publishes domain events to Redis Pub/Sub for inter-context communication.
 * Events are both published to Redis and persisted to the database.
 */

import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { domainEvents } from "@/lib/db/schema/tables";
import type { DomainEvent, IEventPublisher } from "./types";

export class EventPublisher implements IEventPublisher {
  private static instance: EventPublisher;
  private redis: Redis;
  private readonly channelPrefix = "domain-events:";

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
      occurredAt: event.occurredAt || new Date(),
    };

    // Persist event to database (for audit trail and replay)
    await this.persistEvent(enrichedEvent);

    // Publish to Redis Pub/Sub
    await this.publishToRedis(enrichedEvent);
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
    try {
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
    } catch (error) {
      console.error("Failed to persist domain event:", error);
      // Don't throw - event publication should continue even if persistence fails
    }
  }

  /**
   * Publish event to Redis Pub/Sub
   */
  private async publishToRedis(event: DomainEvent): Promise<void> {
    try {
      const channel = `${this.channelPrefix}${event.eventType}`;
      const message = JSON.stringify(event);

      // Publish to specific channel
      // Wildcard subscribers will receive this via psubscribe pattern matching
      await this.redis.publish(channel, message);
    } catch (error) {
      console.error("Failed to publish event to Redis:", error);
      throw error; // Throw here since Redis publish is critical
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
