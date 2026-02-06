/**
 * Analytics Event Subscribers
 *
 * Subscribes to domain events from all contexts and transforms them into
 * activity events for analytics and real-time streaming.
 */

import { EventSubscriber } from "@/lib/contexts/domain-events";
import type { DomainEvent } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { activityEvents } from "@/lib/db/schema";
import type { ActivityCategory } from "../domain/types";
import {
  DomainEventPatterns,
  DomainEventTypes,
  toCanonicalEventType,
} from "@/lib/contexts/domain-events/event-taxonomy";

/**
 * Analytics event subscriber
 *
 * Listens to all domain events and creates activity records.
 */
export class AnalyticsEventSubscriber {
  private subscriber: EventSubscriber;
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.subscriber = EventSubscriber.getInstance(redis);
  }

  /**
   * Start listening to all domain events
   */
  async start(): Promise<void> {
    // Subscribe to specific event patterns to avoid wildcard issues
    const eventPatterns = [
      DomainEventPatterns.task,
      DomainEventPatterns.execution,
      DomainEventPatterns.repository,
      DomainEventPatterns.user,
      DomainEventPatterns.subscription,
      DomainEventPatterns.usage,
    ];

    for (const pattern of eventPatterns) {
      this.subscriber.subscribe({
        eventType: pattern,
        handler: this.handleDomainEvent.bind(this),
        subscriberName: `analytics-subscriber-${pattern}`,
        priority: 10, // Lower priority - process after critical subscribers
      });
    }
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    const eventPatterns = [
      DomainEventPatterns.task,
      DomainEventPatterns.execution,
      DomainEventPatterns.repository,
      DomainEventPatterns.user,
      DomainEventPatterns.subscription,
      DomainEventPatterns.usage,
    ];

    for (const pattern of eventPatterns) {
      this.subscriber.unsubscribe(pattern, `analytics-subscriber-${pattern}`);
    }
  }

  /**
   * Handle domain event and create activity record
   */
  private async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      // Idempotency check: Skip if already processed (24h TTL)
      const inboxKey = `domain-events:inbox:analytics:${event.id}`;
      const alreadyProcessed = await this.redis.get(inboxKey);
      if (alreadyProcessed) {
        return; // Skip duplicate event delivery
      }

      const canonicalEventType = toCanonicalEventType(event.eventType);
      const normalizedEvent: DomainEvent = {
        ...event,
        eventType: canonicalEventType,
      };

      // Skip analytics events to avoid loops
      if (
        normalizedEvent.aggregateType === "Activity" ||
        normalizedEvent.aggregateType === "Summary"
      ) {
        return;
      }

      // Map domain event to activity
      const activity = this.mapEventToActivity(normalizedEvent);
      if (!activity) {
        return;
      }

      // Persist to database
      await db.insert(activityEvents).values({
        userId: activity.userId || null,
        taskId: activity.taskId || null,
        repoId: activity.repoId || null,
        executionId: activity.executionId || null,
        eventType: normalizedEvent.eventType,
        eventCategory: activity.category as "ai_action" | "git" | "system",
        title: activity.title,
        content: activity.content || null,
        metadata: activity.metadata || null,
        createdAt: normalizedEvent.occurredAt,
      });

      // Mark as processed (24h TTL)
      await this.redis.setex(inboxKey, 86400, "1");
    } catch (error) {
      console.error("Failed to handle domain event:", error);
    }
  }

  /**
   * Map domain event to activity
   */
  private mapEventToActivity(event: DomainEvent): {
    userId?: string;
    taskId?: string;
    repoId?: string;
    executionId?: string;
    category: ActivityCategory;
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
  } | null {
    const data = event.data as Record<string, unknown>;

    // Task events
    if (event.aggregateType === "Task") {
      return {
        userId: data.userId as string | undefined,
        taskId: data.taskId as string | undefined,
        repoId: data.repoId as string | undefined,
        category: "system",
        title: this.getTaskEventTitle(event.eventType),
        content: this.getTaskEventContent(event),
        metadata: data,
      };
    }

    // Execution events
    if (event.aggregateType === "Execution") {
      return {
        userId: data.userId as string | undefined,
        taskId: data.taskId as string | undefined,
        executionId: data.executionId as string | undefined,
        category: "ai_action",
        title: this.getExecutionEventTitle(event.eventType),
        content: this.getExecutionEventContent(event),
        metadata: data,
      };
    }

    // Repository events
    if (event.aggregateType === "Repository") {
      return {
        userId: data.userId as string | undefined,
        repoId: data.repoId as string | undefined,
        category: "git",
        title: this.getRepositoryEventTitle(event.eventType),
        content: this.getRepositoryEventContent(event),
        metadata: data,
      };
    }

    // IAM events
    if (event.aggregateType === "User") {
      return {
        userId: data.userId as string | undefined,
        category: "system",
        title: this.getIAMEventTitle(event.eventType),
        content: this.getIAMEventContent(event),
        metadata: data,
      };
    }

    // Billing events
    if (
      event.aggregateType === "Subscription" ||
      event.aggregateType === "Usage"
    ) {
      return {
        userId: data.userId as string | undefined,
        category: "system",
        title: this.getBillingEventTitle(event.eventType),
        content: this.getBillingEventContent(event),
        metadata: data,
      };
    }

    return null;
  }

  /**
   * Get task event title
   */
  private getTaskEventTitle(eventType: string): string {
    const titles: Record<string, string> = {
      [DomainEventTypes.task.created]: "Task created",
      [DomainEventTypes.task.statusChanged]: "Task status changed",
      [DomainEventTypes.task.brainstormingStarted]: "Brainstorming started",
      [DomainEventTypes.task.brainstormingCompleted]: "Brainstorming completed",
      [DomainEventTypes.task.planningStarted]: "Planning started",
      [DomainEventTypes.task.planningCompleted]: "Planning completed",
      [DomainEventTypes.task.executionStarted]: "Execution started",
      [DomainEventTypes.task.executionCompleted]: "Execution completed",
      [DomainEventTypes.task.executionFailed]: "Execution failed",
      [DomainEventTypes.task.stuck]: "Task stuck",
      [DomainEventTypes.task.unblocked]: "Task unblocked",
      [DomainEventTypes.task.dependencyAdded]: "Dependency added",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get task event content
   */
  private getTaskEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case DomainEventTypes.task.created:
        return `Created task: ${data.title || "Untitled"}`;
      case DomainEventTypes.task.statusChanged:
        return `Status: ${data.fromStatus} → ${data.toStatus}`;
      case DomainEventTypes.task.executionCompleted:
        return `Completed with ${data.commitCount || 0} commits`;
      default:
        return undefined;
    }
  }

  /**
   * Get execution event title
   */
  private getExecutionEventTitle(eventType: string): string {
    const titles: Record<string, string> = {
      [DomainEventTypes.execution.started]: "AI execution started",
      [DomainEventTypes.execution.iterationCompleted]: "Iteration completed",
      [DomainEventTypes.execution.filesExtracted]: "Files extracted",
      [DomainEventTypes.execution.commitCreated]: "Commit created",
      [DomainEventTypes.execution.stuckSignalDetected]: "Stuck signal detected",
      [DomainEventTypes.execution.recoveryStarted]: "Recovery started",
      [DomainEventTypes.execution.recoverySucceeded]: "Recovery succeeded",
      [DomainEventTypes.execution.recoveryFailed]: "Recovery failed",
      [DomainEventTypes.execution.completionValidated]: "Completion validated",
      [DomainEventTypes.execution.completed]: "Execution completed",
      [DomainEventTypes.execution.failed]: "Execution failed",
      [DomainEventTypes.execution.skillInvoked]: "Skill invoked",
      [DomainEventTypes.execution.skillBlocked]: "Skill blocked",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get execution event content
   */
  private getExecutionEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case DomainEventTypes.execution.iterationCompleted:
        return `Iteration ${data.iteration}: ${data.actionCount} actions`;
      case DomainEventTypes.execution.commitCreated:
        return `Commit ${data.commitHash}: ${data.filesChanged} files`;
      case DomainEventTypes.execution.recoveryStarted:
        return `Recovery tier ${data.tier}: ${data.strategy}`;
      default:
        return undefined;
    }
  }

  /**
   * Get repository event title
   */
  private getRepositoryEventTitle(eventType: string): string {
    const titles: Record<string, string> = {
      [DomainEventTypes.repository.connected]: "Repository connected",
      [DomainEventTypes.repository.cloneStarted]: "Clone started",
      [DomainEventTypes.repository.cloneCompleted]: "Clone completed",
      [DomainEventTypes.repository.cloneFailed]: "Clone failed",
      [DomainEventTypes.repository.indexingStarted]: "Indexing started",
      [DomainEventTypes.repository.indexingCompleted]: "Indexing completed",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get repository event content
   */
  private getRepositoryEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case DomainEventTypes.repository.connected:
        return `Connected: ${data.repoName}`;
      case DomainEventTypes.repository.indexingCompleted:
        return `Indexed ${data.fileCount || 0} files`;
      default:
        return undefined;
    }
  }

  /**
   * Get IAM event title
   */
  private getIAMEventTitle(eventType: string): string {
    const titles: Record<string, string> = {
      [DomainEventTypes.user.registered]: "User registered",
      [DomainEventTypes.user.providerConfigured]: "Provider configured",
      [DomainEventTypes.user.providerRemoved]: "Provider removed",
      [DomainEventTypes.user.preferencesUpdated]: "Preferences updated",
      [DomainEventTypes.user.onboardingCompleted]: "Onboarding completed",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get IAM event content
   */
  private getIAMEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case DomainEventTypes.user.providerConfigured:
        return `Configured ${data.provider} provider`;
      case DomainEventTypes.user.preferencesUpdated:
        return `Updated preferences`;
      default:
        return undefined;
    }
  }

  /**
   * Get billing event title
   */
  private getBillingEventTitle(eventType: string): string {
    const titles: Record<string, string> = {
      [DomainEventTypes.billing.subscriptionCreated]: "Subscription created",
      [DomainEventTypes.billing.subscriptionUpgraded]: "Subscription upgraded",
      [DomainEventTypes.billing.subscriptionDowngraded]:
        "Subscription downgraded",
      [DomainEventTypes.billing.subscriptionCanceled]: "Subscription canceled",
      [DomainEventTypes.billing.usageRecorded]: "Usage recorded",
      [DomainEventTypes.billing.limitExceeded]: "Limit exceeded",
      [DomainEventTypes.billing.billingPeriodEnded]: "Billing period ended",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get billing event content
   */
  private getBillingEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case DomainEventTypes.billing.subscriptionUpgraded:
        return `Upgraded: ${data.fromTier} → ${data.toTier}`;
      case DomainEventTypes.billing.usageRecorded:
        return `Used ${data.tokensUsed} tokens`;
      case DomainEventTypes.billing.limitExceeded:
        return `Limit exceeded: ${data.limitType}`;
      default:
        return undefined;
    }
  }
}
