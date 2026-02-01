/**
 * Activity Event Helpers
 *
 * Centralized functions for creating activity events across the application.
 * Activity events provide a timeline of task progress and system actions.
 */

import { db, activityEvents } from "@/lib/db";
import type { ActivityEventCategory } from "@/lib/db/schema";

interface CreateActivityEventParams {
  taskId?: string;
  repoId?: string;
  userId: string;
  executionId?: string;
  eventType: string;
  eventCategory: ActivityEventCategory;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an activity event
 */
export async function createActivityEvent(params: CreateActivityEventParams) {
  const event = await db
    .insert(activityEvents)
    .values({
      taskId: params.taskId,
      repoId: params.repoId,
      userId: params.userId,
      executionId: params.executionId,
      eventType: params.eventType,
      eventCategory: params.eventCategory,
      title: params.title,
      content: params.content,
      metadata: params.metadata,
    })
    .returning();

  return event[0];
}

/**
 * Create activity event for task creation
 */
export async function createTaskCreatedEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "task_created",
    eventCategory: "system",
    title: "Task created",
    content: `Created task: ${params.taskTitle}`,
    metadata: {
      taskTitle: params.taskTitle,
    },
  });
}

/**
 * Create activity event for status change
 */
export async function createStatusChangeEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
  fromStatus: string;
  toStatus: string;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "status_change",
    eventCategory: "system",
    title: `Status: ${params.fromStatus} → ${params.toStatus}`,
    content: `Task "${params.taskTitle}" moved from ${params.fromStatus} to ${params.toStatus}`,
    metadata: {
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
    },
  });
}

/**
 * Create activity event for brainstorming start
 */
export async function createBrainstormStartEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "brainstorm_start",
    eventCategory: "ai_action",
    title: "Brainstorming started",
    content: `AI brainstorming session initiated for: ${params.taskTitle}`,
  });
}

/**
 * Create activity event for brainstorming completion
 */
export async function createBrainstormCompleteEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
  messageCount: number;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "brainstorm_complete",
    eventCategory: "ai_action",
    title: "Brainstorming completed",
    content: `Brainstorming session completed with ${params.messageCount} messages`,
    metadata: {
      messageCount: params.messageCount,
    },
  });
}

/**
 * Create activity event for planning start
 */
export async function createPlanningStartEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "planning_start",
    eventCategory: "ai_action",
    title: "Planning started",
    content: `AI generating execution plan for: ${params.taskTitle}`,
  });
}

/**
 * Create activity event for planning completion
 */
export async function createPlanningCompleteEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
  stepCount: number;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "planning_complete",
    eventCategory: "ai_action",
    title: "Plan generated",
    content: `Execution plan created with ${params.stepCount} steps`,
    metadata: {
      stepCount: params.stepCount,
    },
  });
}

/**
 * Create activity event for task update
 */
export async function createTaskUpdatedEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  taskTitle: string;
  changes: string[];
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    eventType: "task_updated",
    eventCategory: "system",
    title: "Task updated",
    content: `Updated: ${params.changes.join(", ")}`,
    metadata: {
      changes: params.changes,
    },
  });
}

/**
 * Create activity event for execution start
 */
export async function createExecutionStartEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  executionId: string;
  taskTitle: string;
}) {
  return createActivityEvent({
    taskId: params.taskId,
    repoId: params.repoId,
    userId: params.userId,
    executionId: params.executionId,
    eventType: "execution_start",
    eventCategory: "system",
    title: "Execution started",
    content: `AI agent began executing: ${params.taskTitle}`,
  });
}

/**
 * Create activity event for execution completion
 */
export async function createExecutionCompleteEvent(params: {
  taskId: string;
  repoId: string;
  userId: string;
  executionId: string;
  taskTitle: string;
  success: boolean;
  commitCount?: number;
}) {
  return createActivityEvent({
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
    metadata: {
      success: params.success,
      commitCount: params.commitCount,
    },
  });
}
