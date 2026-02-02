/**
 * Activity Stream Aggregate
 *
 * Manages activity event streaming and aggregation.
 * This is primarily a read model built from domain events.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type { ActivityEvent, ActivityCategory } from "./types";
import type { ActivityLoggedEvent } from "./events";

/**
 * Activity stream state
 */
export interface ActivityStreamState {
  id: string;
  userId: string;
  events: ActivityEvent[];
  totalEvents: number;
  lastActivityAt: Date;
}

/**
 * Activity Stream aggregate
 *
 * Collects and streams activity events from domain events.
 */
export class ActivityStreamAggregate {
  private state: ActivityStreamState;
  private eventPublisher: EventPublisher;

  constructor(state: ActivityStreamState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get stream ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state
   */
  getState(): ActivityStreamState {
    return { ...this.state };
  }

  /**
   * Create a new activity stream
   */
  static create(
    params: { id: string; userId: string },
    redis: Redis,
  ): ActivityStreamAggregate {
    const state: ActivityStreamState = {
      id: params.id,
      userId: params.userId,
      events: [],
      totalEvents: 0,
      lastActivityAt: new Date(),
    };

    return new ActivityStreamAggregate(state, redis);
  }

  /**
   * Log activity event
   */
  async logActivity(params: {
    eventType: string;
    category: ActivityCategory;
    title: string;
    content?: string;
    taskId?: string;
    repoId?: string;
    executionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const activityId = crypto.randomUUID();
    const now = new Date();

    const activity: ActivityEvent = {
      id: activityId,
      userId: this.state.userId,
      eventType: params.eventType,
      category: params.category,
      title: params.title,
      content: params.content,
      taskId: params.taskId,
      repoId: params.repoId,
      executionId: params.executionId,
      metadata: params.metadata,
      createdAt: now,
    };

    // Add to stream
    this.state.events.push(activity);
    this.state.totalEvents++;
    this.state.lastActivityAt = now;

    // Publish ActivityLogged event
    const event: ActivityLoggedEvent = {
      id: crypto.randomUUID(),
      eventType: "ActivityLogged",
      aggregateType: "Activity",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        activityId,
        userId: this.state.userId,
        taskId: params.taskId,
        repoId: params.repoId,
        executionId: params.executionId,
        category: params.category,
        title: params.title,
        content: params.content,
        metadata: params.metadata,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Get recent activities
   */
  getRecentActivities(limit: number = 50): ActivityEvent[] {
    return this.state.events.slice(-limit).reverse();
  }

  /**
   * Get activities by category
   */
  getActivitiesByCategory(
    category: ActivityCategory,
    limit: number = 50,
  ): ActivityEvent[] {
    return this.state.events
      .filter((e) => e.category === category)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get total event count
   */
  getTotalEvents(): number {
    return this.state.totalEvents;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivityAt(): Date {
    return this.state.lastActivityAt;
  }
}
