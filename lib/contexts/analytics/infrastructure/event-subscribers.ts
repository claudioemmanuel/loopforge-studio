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
      "Task.*",
      "Execution.*",
      "Repository.*",
      "User.*",
      "Subscription.*",
      "Usage.*",
    ];

    for (const pattern of eventPatterns) {
      this.subscriber.subscribe(pattern, this.handleDomainEvent.bind(this), {
        subscriberId: `analytics-subscriber-${pattern}`,
        priority: 10, // Lower priority - process after critical subscribers
      });
    }
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    const eventPatterns = [
      "Task.*",
      "Execution.*",
      "Repository.*",
      "User.*",
      "Subscription.*",
      "Usage.*",
    ];

    for (const pattern of eventPatterns) {
      this.subscriber.unsubscribe(`analytics-subscriber-${pattern}`, pattern);
    }
  }

  /**
   * Handle domain event and create activity record
   */
  private async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      // Skip analytics events to avoid loops
      if (
        event.aggregateType === "Activity" ||
        event.aggregateType === "Summary"
      ) {
        return;
      }

      // Map domain event to activity
      const activity = this.mapEventToActivity(event);
      if (!activity) {
        return;
      }

      // Persist to database
      await db.insert(activityEvents).values({
        id: crypto.randomUUID(),
        userId: activity.userId || null,
        taskId: activity.taskId || null,
        repoId: activity.repoId || null,
        executionId: activity.executionId || null,
        eventType: event.eventType,
        eventCategory: activity.category,
        title: activity.title,
        content: activity.content || null,
        metadata: activity.metadata || null,
        createdAt: event.occurredAt,
      });
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
      TaskCreated: "Task created",
      TaskStatusChanged: "Task status changed",
      BrainstormingStarted: "Brainstorming started",
      BrainstormingCompleted: "Brainstorming completed",
      PlanningStarted: "Planning started",
      PlanningCompleted: "Planning completed",
      ExecutionStarted: "Execution started",
      ExecutionCompleted: "Execution completed",
      ExecutionFailed: "Execution failed",
      TaskStuck: "Task stuck",
      TaskUnblocked: "Task unblocked",
      DependencyAdded: "Dependency added",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get task event content
   */
  private getTaskEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case "TaskCreated":
        return `Created task: ${data.title || "Untitled"}`;
      case "TaskStatusChanged":
        return `Status: ${data.fromStatus} → ${data.toStatus}`;
      case "ExecutionCompleted":
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
      ExecutionStarted: "AI execution started",
      IterationCompleted: "Iteration completed",
      FilesExtracted: "Files extracted",
      CommitCreated: "Commit created",
      StuckSignalDetected: "Stuck signal detected",
      RecoveryStarted: "Recovery started",
      RecoverySucceeded: "Recovery succeeded",
      RecoveryFailed: "Recovery failed",
      CompletionValidated: "Completion validated",
      ExecutionCompleted: "Execution completed",
      ExecutionFailed: "Execution failed",
      SkillInvoked: "Skill invoked",
      SkillBlocked: "Skill blocked",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get execution event content
   */
  private getExecutionEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case "IterationCompleted":
        return `Iteration ${data.iteration}: ${data.actionCount} actions`;
      case "CommitCreated":
        return `Commit ${data.commitHash}: ${data.filesChanged} files`;
      case "RecoveryStarted":
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
      RepositoryConnected: "Repository connected",
      CloneStarted: "Clone started",
      CloneCompleted: "Clone completed",
      CloneFailed: "Clone failed",
      IndexingStarted: "Indexing started",
      IndexingCompleted: "Indexing completed",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get repository event content
   */
  private getRepositoryEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case "RepositoryConnected":
        return `Connected: ${data.repoName}`;
      case "IndexingCompleted":
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
      UserRegistered: "User registered",
      ProviderConfigured: "Provider configured",
      ProviderRemoved: "Provider removed",
      UserPreferencesUpdated: "Preferences updated",
      OnboardingCompleted: "Onboarding completed",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get IAM event content
   */
  private getIAMEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case "ProviderConfigured":
        return `Configured ${data.provider} provider`;
      case "UserPreferencesUpdated":
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
      SubscriptionCreated: "Subscription created",
      SubscriptionUpgraded: "Subscription upgraded",
      SubscriptionDowngraded: "Subscription downgraded",
      SubscriptionCanceled: "Subscription canceled",
      UsageRecorded: "Usage recorded",
      LimitExceeded: "Limit exceeded",
      BillingPeriodEnded: "Billing period ended",
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get billing event content
   */
  private getBillingEventContent(event: DomainEvent): string | undefined {
    const data = event.data as Record<string, unknown>;

    switch (event.eventType) {
      case "SubscriptionUpgraded":
        return `Upgraded: ${data.fromTier} → ${data.toTier}`;
      case "UsageRecorded":
        return `Used ${data.tokensUsed} tokens`;
      case "LimitExceeded":
        return `Limit exceeded: ${data.limitType}`;
      default:
        return undefined;
    }
  }
}
