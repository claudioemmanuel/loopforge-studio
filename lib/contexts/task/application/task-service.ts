/**
 * Task Service (Application Layer)
 *
 * CRUD + status-transition operations for tasks.
 * Uses Drizzle directly for now; the existing
 * lib/domain/aggregates/task.ts aggregate can be wired in later.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tables";
import { eq, and } from "drizzle-orm";

export class TaskService {
  // Kept for future event publishing.
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /** Get a single task by ID (includes repo relation). */
  async getTaskFull(taskId: string) {
    return db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });
  }

  /** List tasks for a repository, ordered by priority then createdAt. */
  async listByRepo(repoId: string) {
    return db.query.tasks.findMany({
      where: eq(tasks.repoId, repoId),
      orderBy: (t, { asc }) => [asc(t.priority), asc(t.createdAt)],
    });
  }

  /** List all tasks owned by a user (via repos). */
  async listByUserId(userId: string) {
    return db.query.tasks
      .findMany({
        with: {
          repo: true,
        },
      })
      .then((allTasks) => allTasks.filter((t) => t.repo?.userId === userId));
  }

  // =========================================================================
  // Create
  // =========================================================================

  /** Create a new task. Returns the inserted row. */
  async createTask(params: {
    repoId: string;
    title: string;
    description?: string | null;
    autonomousMode?: boolean;
    autoApprove?: boolean;
  }) {
    const taskId = crypto.randomUUID();

    const row = {
      id: taskId,
      repoId: params.repoId,
      title: params.title,
      description: params.description ?? null,
      status: "todo" as const,
      priority: 0,
      brainstormResult: null,
      brainstormConversation: null,
      planContent: null,
      branch: null,
      autonomousMode: params.autonomousMode ?? false,
      autoApprove: params.autoApprove ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(tasks).values(row);
    return row;
  }

  // =========================================================================
  // Update helpers used by PATCH /api/tasks/:taskId
  // =========================================================================

  /** Generic field update.  Caller is responsible for validation. */
  async updateFields(
    taskId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(tasks)
      .set({ ...fields, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(tasks.id, taskId));
  }

  /** Delete a task by ID. */
  async deleteTask(taskId: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  /** Verify that a task exists and belongs to the given repo. */
  async verifyOwnership(taskId: string, repoId: string): Promise<boolean> {
    const row = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.repoId, repoId)),
    });
    return !!row;
  }
}
