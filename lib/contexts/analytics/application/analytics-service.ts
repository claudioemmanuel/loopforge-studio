/**
 * Analytics Service (Application Layer)
 *
 * Single entry-point for writing activity events and reading analytics data.
 * Delegates all queries to the AnalyticsQueryRepository for better testability.
 */

import type { Redis } from "ioredis";
import { ActivityRepository } from "../infrastructure/activity-repository";
import {
  AnalyticsQueryRepository,
  type DateRange,
} from "../infrastructure/analytics-query-repository";

export interface RecordActivityEventParams {
  taskId?: string;
  repoId?: string;
  userId: string;
  executionId?: string;
  eventType: string;
  /** "ai_action" | "git" | "system" */
  eventCategory: "ai_action" | "git" | "system";
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export class AnalyticsService {
  private activityRepository: ActivityRepository;
  private queryRepository: AnalyticsQueryRepository;

  constructor(
    redis: Redis,
    queryRepository: AnalyticsQueryRepository = new AnalyticsQueryRepository(),
  ) {
    this.activityRepository = new ActivityRepository(redis);
    this.queryRepository = queryRepository;
  }

  // =========================================================================
  // Generic event recorder  –  replaces createActivityEvent()
  // =========================================================================

  async recordActivityEvent(params: RecordActivityEventParams): Promise<void> {
    await this.activityRepository.recordActivity({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      executionId: params.executionId,
      eventType: params.eventType,
      eventCategory: params.eventCategory,
      title: params.title,
      content: params.content,
      metadata: params.metadata,
    });
  }

  // =========================================================================
  // Named convenience helpers  –  match the old lib/activity/helpers.ts API
  // so call-sites can migrate one function at a time.
  // =========================================================================

  async taskCreated(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
  }): Promise<void> {
    return this.recordActivityEvent({
      ...params,
      eventType: "task_created",
      eventCategory: "system",
      title: "Task created",
      content: `Created task: ${params.taskTitle}`,
      metadata: { taskTitle: params.taskTitle },
    });
  }

  async statusChanged(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
    fromStatus: string;
    toStatus: string;
  }): Promise<void> {
    return this.recordActivityEvent({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      eventType: "status_change",
      eventCategory: "system",
      title: `Status: ${params.fromStatus} → ${params.toStatus}`,
      content: `Task "${params.taskTitle}" moved from ${params.fromStatus} to ${params.toStatus}`,
      metadata: { fromStatus: params.fromStatus, toStatus: params.toStatus },
    });
  }

  async brainstormStarted(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
  }): Promise<void> {
    return this.recordActivityEvent({
      ...params,
      eventType: "brainstorm_start",
      eventCategory: "ai_action",
      title: "Brainstorming started",
      content: `AI brainstorming session initiated for: ${params.taskTitle}`,
    });
  }

  async brainstormCompleted(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
    messageCount: number;
  }): Promise<void> {
    return this.recordActivityEvent({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      eventType: "brainstorm_complete",
      eventCategory: "ai_action",
      title: "Brainstorming completed",
      content: `Brainstorming session completed with ${params.messageCount} messages`,
      metadata: { messageCount: params.messageCount },
    });
  }

  async planningStarted(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
  }): Promise<void> {
    return this.recordActivityEvent({
      ...params,
      eventType: "planning_start",
      eventCategory: "ai_action",
      title: "Planning started",
      content: `AI generating execution plan for: ${params.taskTitle}`,
    });
  }

  async planningCompleted(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
    stepCount: number;
  }): Promise<void> {
    return this.recordActivityEvent({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      eventType: "planning_complete",
      eventCategory: "ai_action",
      title: "Plan generated",
      content: `Execution plan created with ${params.stepCount} steps`,
      metadata: { stepCount: params.stepCount },
    });
  }

  async taskUpdated(params: {
    taskId: string;
    repoId: string;
    userId: string;
    taskTitle: string;
    changes: string[];
  }): Promise<void> {
    return this.recordActivityEvent({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      eventType: "task_updated",
      eventCategory: "system",
      title: "Task updated",
      content: `Updated: ${params.changes.join(", ")}`,
      metadata: { changes: params.changes },
    });
  }

  async executionStarted(params: {
    taskId: string;
    repoId: string;
    userId: string;
    executionId: string;
    taskTitle: string;
  }): Promise<void> {
    return this.recordActivityEvent({
      ...params,
      eventType: "execution_start",
      eventCategory: "system",
      title: "Execution started",
      content: `AI agent began executing: ${params.taskTitle}`,
    });
  }

  async executionCompleted(params: {
    taskId: string;
    repoId: string;
    userId: string;
    executionId: string;
    taskTitle: string;
    success: boolean;
    commitCount?: number;
  }): Promise<void> {
    return this.recordActivityEvent({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      executionId: params.executionId,
      eventType: "execution_complete",
      eventCategory: "system",
      title: params.success ? "Execution completed" : "Execution failed",
      content: params.success
        ? `Successfully completed with ${params.commitCount || 0} commits`
        : "Execution failed - check logs for details",
      metadata: { success: params.success, commitCount: params.commitCount },
    });
  }

  // =========================================================================
  // Dashboard analytics  –  delegates to query repository
  // =========================================================================

  async getTaskMetrics(userId: string, dateRange: DateRange) {
    return this.queryRepository.getTaskMetrics(userId, dateRange);
  }

  async getTasksByStatus(userId: string, dateRange: DateRange) {
    return this.queryRepository.getTasksByStatus(userId, dateRange);
  }

  async getDailyCompletions(userId: string, dateRange: DateRange) {
    return this.queryRepository.getDailyCompletions(userId, dateRange);
  }

  async getRepoActivity(userId: string, dateRange: DateRange) {
    return this.queryRepository.getRepoActivity(userId, dateRange);
  }

  async getTokenUsage(userId: string, dateRange: DateRange) {
    return this.queryRepository.getTokenUsage(userId, dateRange);
  }

  async getCostBreakdown(userId: string, dateRange: DateRange) {
    return this.queryRepository.getCostBreakdown(userId, dateRange);
  }

  // =========================================================================
  // Activity feed queries  –  delegates to query repository
  // =========================================================================

  async getActivityFeed(repoId: string, limit: number) {
    return this.queryRepository.getActivityFeed(repoId, limit);
  }

  async getActivityHistory(repoId: string, limit: number) {
    return this.queryRepository.getActivityHistory(repoId, limit);
  }

  async getActivityChanges(repoId: string, limit: number) {
    return this.queryRepository.getActivityChanges(repoId, limit);
  }

  async getActivitySummary(repoId: string, days: number) {
    return this.queryRepository.getActivitySummary(repoId, days);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /** Delete all activity events for a user (account deletion). */
  async deleteUserActivities(userId: string): Promise<void> {
    await this.activityRepository.deleteByUserId(userId);
  }
}
