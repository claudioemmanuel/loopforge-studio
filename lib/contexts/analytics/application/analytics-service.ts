/**
 * Analytics Service (Application Layer)
 *
 * Single entry-point for writing activity events.
 * Replaces every helper exported by lib/activity/helpers.ts.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { activityEvents } from "@/lib/db/schema";

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
  // Kept for future event-bus wiring.
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  // =========================================================================
  // Generic event recorder  –  replaces createActivityEvent()
  // =========================================================================

  async recordActivityEvent(params: RecordActivityEventParams): Promise<void> {
    await db.insert(activityEvents).values({
      taskId: params.taskId ?? null,
      repoId: params.repoId ?? null,
      userId: params.userId,
      executionId: params.executionId ?? null,
      eventType: params.eventType,
      eventCategory: params.eventCategory,
      title: params.title,
      content: params.content ?? null,
      metadata: params.metadata ?? null,
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
}
