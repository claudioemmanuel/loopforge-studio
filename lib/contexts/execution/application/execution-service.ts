/**
 * Execution Service (Application Layer)
 *
 * Queries and status updates for AI executions.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema/tables";
import { eq, inArray } from "drizzle-orm";

export class ExecutionService {
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /** Get the latest execution for a task. */
  async getLatestForTask(taskId: string) {
    return db.query.executions.findFirst({
      where: eq(executions.taskId, taskId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  /** Get all executions for a task. */
  async listByTask(taskId: string) {
    return db.query.executions.findMany({
      where: eq(executions.taskId, taskId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  /** Get a single execution by ID. */
  async getById(executionId: string) {
    return db.query.executions.findFirst({
      where: eq(executions.id, executionId),
    });
  }

  // =========================================================================
  // Mutations (used by routes and the worker)
  // =========================================================================

  /** Create an execution record. */
  async create(params: {
    id: string;
    taskId: string;
    status?: string;
  }): Promise<string> {
    await db.insert(executions).values({
      id: params.id,
      taskId: params.taskId,
      status: (params.status ??
        "queued") as typeof executions.$inferInsert.status,
      iteration: 0,
      createdAt: new Date(),
    });
    return params.id;
  }

  /** Mark execution as running. */
  async markRunning(executionId: string): Promise<void> {
    await db
      .update(executions)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(executions.id, executionId));
  }

  /** Mark execution as completed with optional PR info. */
  async markCompleted(params: {
    executionId: string;
    commits?: string[];
    prUrl?: string;
    prNumber?: number;
  }): Promise<void> {
    const updates: Record<string, unknown> = {
      status: "completed",
      completedAt: new Date(),
    };
    if (params.commits) updates.commits = params.commits;
    if (params.prUrl !== undefined) updates.prUrl = params.prUrl;
    if (params.prNumber !== undefined) updates.prNumber = params.prNumber;

    await db
      .update(executions)
      .set(updates as typeof executions.$inferInsert)
      .where(eq(executions.id, params.executionId));
  }

  /** Mark execution as failed. */
  async markFailed(executionId: string, errorMessage: string): Promise<void> {
    await db
      .update(executions)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
  }

  /** Mark execution as stuck. */
  async markStuck(executionId: string, signals?: unknown[]): Promise<void> {
    const updates: Record<string, unknown> = {
      status: "stuck",
      completedAt: new Date(),
    };
    if (signals) updates.stuckSignals = signals;

    await db
      .update(executions)
      .set(updates as typeof executions.$inferInsert)
      .where(eq(executions.id, executionId));
  }

  /** Delete all executions for the given tasks (account cleanup). */
  async deleteByTaskIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await db.delete(executions).where(inArray(executions.taskId, taskIds));
  }
}
