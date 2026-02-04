/**
 * Task Service (Application Layer)
 *
 * CRUD + status-transition operations for tasks.
 * Uses Drizzle directly for now; the existing
 * lib/domain/aggregates/task.ts aggregate can be wired in later.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { tasks, repos, executions } from "@/lib/db/schema/tables";
import { eq, and, or, isNull, isNotNull, inArray, desc } from "drizzle-orm";

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

  /**
   * List tasks with active workers for a user, grouped with their latest
   * execution and repo info. Used by the Workers dashboard.
   *
   * @param filter  "all" | "active" | "completed" | "stuck"
   */
  async listActiveWorkerTasks(userId: string, filter: string = "all") {
    // 1. Get user's repos
    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
    });
    if (userRepos.length === 0)
      return { tasks: [], repoMap: new Map(), executionMap: new Map() };

    const repoIds = userRepos.map((r) => r.id);
    const repoMap = new Map(userRepos.map((r) => [r.id, r]));

    // 2. Status filter
    const statusFilter: string[] =
      filter === "active"
        ? ["brainstorming", "planning", "ready", "executing"]
        : filter === "completed"
          ? ["done"]
          : filter === "stuck"
            ? ["stuck"]
            : [
                "brainstorming",
                "planning",
                "ready",
                "executing",
                "done",
                "stuck",
              ];

    // 3. Worker tasks: autonomous OR processing OR stuck
    const workerTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.repoId, repoIds),
        inArray(
          tasks.status,
          statusFilter as (typeof tasks.$inferSelect.status)[],
        ),
        or(
          eq(tasks.autonomousMode, true),
          isNotNull(tasks.processingPhase),
          eq(tasks.status, "stuck" as typeof tasks.$inferSelect.status),
        ),
      ),
      orderBy: [desc(tasks.updatedAt)],
      limit: 50,
    });

    // 4. Latest execution per task (in-JS dedup – safe, simple)
    const taskIds = workerTasks.map((t) => t.id);
    const executionMap = new Map<string, typeof executions.$inferSelect>();

    if (taskIds.length > 0) {
      const allExecutions = await db.query.executions.findMany({
        where: inArray(executions.taskId, taskIds),
        orderBy: [desc(executions.createdAt)],
      });
      for (const exec of allExecutions) {
        if (!executionMap.has(exec.taskId)) {
          executionMap.set(exec.taskId, exec);
        }
      }
    }

    return { tasks: workerTasks, repoMap, executionMap };
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

  /**
   * Atomically claim the processing slot on a task.
   * Returns the updated row if the slot was free, or null if already claimed.
   */
  async claimProcessingSlot(
    taskId: string,
    phase: string,
    statusText: string,
    newStatus: string,
  ) {
    const rows = await db
      .update(tasks)
      .set({
        status: newStatus as typeof tasks.$inferInsert.status,
        processingPhase: phase as typeof tasks.$inferInsert.processingPhase,
        processingStatusText: statusText,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), isNull(tasks.processingPhase)))
      .returning();
    return rows[0] ?? null;
  }

  /** Clear the processing slot and optionally set result fields. */
  async clearProcessingSlot(
    taskId: string,
    fields?: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(tasks)
      .set({
        processingPhase: null,
        processingStatusText: null,
        updatedAt: new Date(),
        ...fields,
      } as Record<string, unknown>)
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

  /** Return task IDs belonging to the given repos (used in cascade deletion). */
  async getIdsByRepoIds(repoIds: string[]): Promise<string[]> {
    if (repoIds.length === 0) return [];
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.repoId, repoIds));
    return rows.map((r) => r.id);
  }

  /** Delete all tasks for the given repos (account cleanup). */
  async deleteByRepoIds(repoIds: string[]): Promise<void> {
    if (repoIds.length === 0) return;
    await db.delete(tasks).where(inArray(tasks.repoId, repoIds));
  }
}
