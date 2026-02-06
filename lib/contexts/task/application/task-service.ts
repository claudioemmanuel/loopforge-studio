/**
 * Task Service (Application Layer)
 *
 * Provides route-facing orchestration/query methods for Task context.
 */

import type { Redis } from "ioredis";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tasks,
  repos,
  executions,
  taskDependencies,
} from "@/lib/db/schema/tables";
import { buildStatusHistoryAppend } from "@/lib/db/status-history";
import type { TaskStatus } from "@/lib/db/schema";

const ACTIVE_WORKER_STATUSES = [
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "stuck",
] as const;

export function getWorkerStatusesForFilter(filter?: string): TaskStatus[] {
  if (!filter || filter === "all") {
    return [...ACTIVE_WORKER_STATUSES];
  }

  if ((ACTIVE_WORKER_STATUSES as readonly string[]).includes(filter)) {
    return [filter as TaskStatus];
  }

  return [...ACTIVE_WORKER_STATUSES];
}

export class TaskService {
  constructor(redis: Redis) {
    void redis;
  }

  async getTaskFull(taskId: string) {
    return db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });
  }

  async getTaskWithLatestExecution(taskId: string) {
    return db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        executions: {
          limit: 1,
          orderBy: (e, { desc }) => [desc(e.createdAt)],
        },
      },
    });
  }

  async listByRepo(repoId: string) {
    return db.query.tasks.findMany({
      where: eq(tasks.repoId, repoId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  async listDependentsByBlocker(blockedByTaskId: string) {
    return db.query.taskDependencies.findMany({
      where: eq(taskDependencies.blockedById, blockedByTaskId),
      with: {
        task: {
          columns: { id: true, title: true, status: true },
        },
      },
    });
  }

  async listDependentsByBlockerWithRepo(blockedByTaskId: string) {
    return db.query.taskDependencies.findMany({
      where: eq(taskDependencies.blockedById, blockedByTaskId),
      with: {
        task: {
          with: {
            repo: true,
          },
        },
      },
    });
  }

  async listBlockersForTask(taskId: string) {
    return db.query.taskDependencies.findMany({
      where: eq(taskDependencies.taskId, taskId),
      with: {
        blockedBy: {
          columns: { status: true, id: true },
        },
      },
    });
  }

  async listByUserId(userId: string) {
    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
      columns: { id: true },
    });

    if (userRepos.length === 0) return [];

    return db.query.tasks.findMany({
      where: inArray(
        tasks.repoId,
        userRepos.map((r) => r.id),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  async listByIds(taskIds: string[]) {
    if (taskIds.length === 0) return [];
    return db.query.tasks.findMany({
      where: inArray(tasks.id, taskIds),
    });
  }

  async countByUser(userId: string): Promise<number> {
    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
      columns: { id: true },
    });

    if (userRepos.length === 0) return 0;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        inArray(
          tasks.repoId,
          userRepos.map((r) => r.id),
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  async getIdsByRepoIds(repoIds: string[]): Promise<string[]> {
    if (repoIds.length === 0) return [];

    const rows = await db.query.tasks.findMany({
      where: inArray(tasks.repoId, repoIds),
      columns: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async deleteByRepoIds(repoIds: string[]): Promise<void> {
    if (repoIds.length === 0) return;

    await db.delete(tasks).where(inArray(tasks.repoId, repoIds));
  }

  async updateFields(
    taskId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(tasks)
      .set({ ...fields, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(tasks.id, taskId));
  }

  async updateIfStatus(
    taskId: string,
    expectedStatuses: TaskStatus[],
    fields: Record<string, unknown>,
  ): Promise<boolean> {
    const result = await db
      .update(tasks)
      .set({ ...fields, updatedAt: new Date() } as Record<string, unknown>)
      .where(and(eq(tasks.id, taskId), inArray(tasks.status, expectedStatuses)))
      .returning({ id: tasks.id });

    return result.length > 0;
  }

  async claimProcessingSlot(
    taskId: string,
    status: TaskStatus,
    statusText?: string,
    phase?: "brainstorming" | "planning" | "executing",
  ) {
    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      columns: { status: true },
    });

    if (!existing) return null;

    const claimed = await db
      .update(tasks)
      .set({
        status,
        statusHistory: buildStatusHistoryAppend({
          fromStatus: existing.status,
          toStatus: status,
          triggeredBy: "user",
        }),
        processingPhase: phase ?? null,
        processingStartedAt: new Date(),
        processingStatusText: statusText ?? null,
        processingProgress: 0,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), isNull(tasks.processingPhase)))
      .returning();

    if (claimed.length === 0) return null;

    return db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });
  }

  async clearProcessingSlot(
    taskId: string,
    updates: Record<string, unknown> = {},
  ): Promise<void> {
    const current = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      columns: { status: true },
    });

    const setPayload: Record<string, unknown> = {
      processingPhase: null,
      processingJobId: null,
      processingStartedAt: null,
      processingStatusText: null,
      processingProgress: 0,
      updatedAt: new Date(),
      ...updates,
    };

    const nextStatus = (updates.status as TaskStatus | undefined) ?? null;
    if (current && nextStatus && nextStatus !== current.status) {
      setPayload.statusHistory = buildStatusHistoryAppend({
        fromStatus: current.status,
        toStatus: nextStatus,
        triggeredBy: "user",
      });
    }

    await db.update(tasks).set(setPayload).where(eq(tasks.id, taskId));
  }

  async listActiveWorkerTasks(userId: string, filter = "all") {
    const statuses = getWorkerStatusesForFilter(filter);

    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
    });

    const repoMap = new Map(userRepos.map((repo) => [repo.id, repo]));
    const repoIds = userRepos.map((repo) => repo.id);

    if (repoIds.length === 0) {
      return {
        tasks: [] as Awaited<ReturnType<typeof db.query.tasks.findMany>>,
        repoMap,
        executionMap: new Map<
          string,
          Awaited<ReturnType<typeof db.query.executions.findMany>>[number]
        >(),
      };
    }

    const workerTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.repoId, repoIds),
        inArray(tasks.status, statuses),
      ),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });

    const taskIds = workerTasks.map((task) => task.id);
    const executionRows =
      taskIds.length > 0
        ? await db.query.executions.findMany({
            where: inArray(executions.taskId, taskIds),
            orderBy: (e, { desc }) => [desc(e.createdAt)],
          })
        : [];

    const executionMap = new Map<string, (typeof executionRows)[number]>();
    for (const execution of executionRows) {
      if (!executionMap.has(execution.taskId)) {
        executionMap.set(execution.taskId, execution);
      }
    }

    return {
      tasks: workerTasks,
      repoMap,
      executionMap,
    };
  }
}
