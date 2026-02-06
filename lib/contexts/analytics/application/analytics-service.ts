/**
 * Analytics Service (Application Layer)
 *
 * Single entry-point for writing activity events.
 * Replaces every helper exported by lib/activity/helpers.ts.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import {
  activityEvents,
  tasks,
  repos,
  executions,
  usageRecords,
  executionEvents,
} from "@/lib/db/schema";
import { eq, and, inArray, gte, lte, sql, desc } from "drizzle-orm";
import { eachDayOfInterval, format } from "date-fns";
import { ActivityRepository } from "../infrastructure/activity-repository";

export interface DateRange {
  start: Date;
  end: Date;
}

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

  constructor(redis: Redis) {
    this.activityRepository = new ActivityRepository(redis);
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
  // Dashboard analytics  –  replaces lib/api/analytics.ts
  // =========================================================================

  async getTaskMetrics(userId: string, dateRange: DateRange) {
    const repoIds = await this._getRepoIds(userId);
    if (repoIds.length === 0) {
      return {
        total: 0,
        completed: 0,
        executing: 0,
        stuck: 0,
        successRate: 0,
        avgCompletionTimeMinutes: null,
      };
    }

    const allTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.repoId, repoIds),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end),
      ),
    });

    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === "done").length;
    const executing = allTasks.filter((t) => t.status === "executing").length;
    const stuck = allTasks.filter((t) => t.status === "stuck").length;

    return {
      total,
      completed,
      executing,
      stuck,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgCompletionTimeMinutes: null as number | null,
    };
  }

  async getTasksByStatus(userId: string, dateRange: DateRange) {
    const repoIds = await this._getRepoIds(userId);
    if (repoIds.length === 0) return [];

    const allTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.repoId, repoIds),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end),
      ),
    });

    const counts: Record<string, number> = {};
    for (const t of allTasks) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
    }));
  }

  async getDailyCompletions(userId: string, dateRange: DateRange) {
    const repoIds = await this._getRepoIds(userId);
    if (repoIds.length === 0) return [];

    const completedTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.repoId, repoIds),
        eq(tasks.status, "done"),
        gte(tasks.updatedAt, dateRange.start),
        lte(tasks.updatedAt, dateRange.end),
      ),
    });

    const tasksByDate = new Map<string, number>();
    for (const task of completedTasks) {
      const key = format(task.updatedAt, "yyyy-MM-dd");
      tasksByDate.set(key, (tasksByDate.get(key) ?? 0) + 1);
    }

    return eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    }).map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      return { date: dayStr, completed: tasksByDate.get(dayStr) ?? 0 };
    });
  }

  async getRepoActivity(userId: string, dateRange: DateRange) {
    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
    });
    if (userRepos.length === 0) return [];

    const repoIds = userRepos.map((r) => r.id);

    const allTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.repoId, repoIds),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end),
      ),
    });

    const taskIds = allTasks.map((t) => t.id);
    const allExecs =
      taskIds.length > 0
        ? await db.query.executions.findMany({
            where: inArray(executions.taskId, taskIds),
          })
        : [];

    const tasksByRepo = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      const arr = tasksByRepo.get(task.repoId) ?? [];
      arr.push(task);
      tasksByRepo.set(task.repoId, arr);
    }

    const execsByTask = new Map<string, typeof allExecs>();
    for (const exec of allExecs) {
      const arr = execsByTask.get(exec.taskId) ?? [];
      arr.push(exec);
      execsByTask.set(exec.taskId, arr);
    }

    return userRepos.map((repo) => {
      const repoTasks = tasksByRepo.get(repo.id) ?? [];
      let commits = 0;
      for (const task of repoTasks) {
        commits += (execsByTask.get(task.id) ?? []).reduce(
          (sum, e) => sum + (e.commits?.length || 0),
          0,
        );
      }
      return {
        repoId: repo.id,
        repoName: repo.fullName,
        commits,
        tasksCompleted: repoTasks.filter((t) => t.status === "done").length,
      };
    });
  }

  async getTokenUsage(userId: string, dateRange: DateRange) {
    const records = await db.query.usageRecords.findMany({
      where: and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.periodStart, dateRange.start),
        lte(usageRecords.periodEnd, dateRange.end),
      ),
    });

    return {
      totalTokens: records.reduce((s, r) => s + r.totalTokens, 0),
      inputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
      estimatedCostCents: records.reduce((s, r) => s + r.estimatedCost, 0),
    };
  }

  async getCostBreakdown(userId: string, dateRange: DateRange) {
    const records = await db.query.usageRecords.findMany({
      where: and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.periodStart, dateRange.start),
        lte(usageRecords.periodEnd, dateRange.end),
      ),
    });

    const byModel: Record<
      string,
      {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCostCents: number;
      }
    > = {};
    const total = {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 0,
    };

    for (const r of records) {
      if (!byModel[r.model]) {
        byModel[r.model] = {
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostCents: 0,
        };
      }
      byModel[r.model].totalTokens += r.totalTokens;
      byModel[r.model].inputTokens += r.inputTokens;
      byModel[r.model].outputTokens += r.outputTokens;
      byModel[r.model].estimatedCostCents += r.estimatedCost;
      total.totalTokens += r.totalTokens;
      total.inputTokens += r.inputTokens;
      total.outputTokens += r.outputTokens;
      total.estimatedCostCents += r.estimatedCost;
    }

    const empty = () => ({
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 0,
    });

    return {
      byModel,
      byPhase: {
        brainstorm: empty(),
        plan: empty(),
        execution: empty(),
        total,
      },
      total,
    };
  }

  // =========================================================================
  // Activity feed queries  –  replaces direct DB in activity/* routes
  // =========================================================================

  async getActivityFeed(repoId: string, limit: number) {
    const events = await db
      .select({
        id: activityEvents.id,
        eventType: activityEvents.eventType,
        title: activityEvents.title,
        content: activityEvents.content,
        createdAt: activityEvents.createdAt,
        taskId: tasks.id,
        taskTitle: tasks.title,
        metadata: activityEvents.metadata,
      })
      .from(activityEvents)
      .innerJoin(tasks, eq(activityEvents.taskId, tasks.id))
      .where(eq(tasks.repoId, repoId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);

    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title || `${e.eventType} event`,
      content: e.content,
      createdAt: e.createdAt.toISOString(),
      task: e.taskId ? { id: e.taskId, title: e.taskTitle } : undefined,
      metadata: e.metadata,
    }));
  }

  async getActivityHistory(repoId: string, limit: number) {
    return db
      .select({
        id: activityEvents.id,
        taskId: tasks.id,
        taskTitle: tasks.title,
        eventType: activityEvents.eventType,
        eventCategory: activityEvents.eventCategory,
        title: activityEvents.title,
        content: activityEvents.content,
        createdAt: activityEvents.createdAt,
        metadata: activityEvents.metadata,
      })
      .from(activityEvents)
      .innerJoin(tasks, eq(activityEvents.taskId, tasks.id))
      .where(eq(tasks.repoId, repoId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);
  }

  async getActivityChanges(repoId: string, limit: number) {
    return db
      .select({
        id: activityEvents.id,
        taskId: tasks.id,
        taskTitle: tasks.title,
        eventType: activityEvents.eventType,
        title: activityEvents.title,
        content: activityEvents.content,
        createdAt: activityEvents.createdAt,
        metadata: activityEvents.metadata,
      })
      .from(activityEvents)
      .innerJoin(tasks, eq(activityEvents.taskId, tasks.id))
      .where(
        and(eq(tasks.repoId, repoId), eq(activityEvents.eventCategory, "git")),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);
  }

  async getActivitySummary(repoId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [executionStats, eventStats, totalEvents] = await Promise.all([
      db
        .select({
          status: executions.status,
          count: sql<number>`count(*)::int`,
        })
        .from(executions)
        .innerJoin(tasks, eq(executions.taskId, tasks.id))
        .where(and(eq(tasks.repoId, repoId), gte(executions.startedAt, since)))
        .groupBy(executions.status),
      db
        .select({
          eventType: executionEvents.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(executionEvents)
        .innerJoin(tasks, eq(executionEvents.taskId, tasks.id))
        .where(
          and(eq(tasks.repoId, repoId), gte(executionEvents.createdAt, since)),
        )
        .groupBy(executionEvents.eventType),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(executionEvents)
        .innerJoin(tasks, eq(executionEvents.taskId, tasks.id))
        .where(
          and(eq(tasks.repoId, repoId), gte(executionEvents.createdAt, since)),
        ),
    ]);

    return {
      period: { days, since: since.toISOString() },
      executions: executionStats.reduce(
        (acc, s) => {
          acc[s.status] = s.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      events: {
        total: totalEvents[0]?.count || 0,
        byType: eventStats.reduce(
          (acc, s) => {
            acc[s.eventType] = s.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /** Delete all activity events for a user (account deletion). */
  async deleteUserActivities(userId: string): Promise<void> {
    await this.activityRepository.deleteByUserId(userId);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private async _getRepoIds(userId: string): Promise<string[]> {
    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
    });
    return userRepos.map((r) => r.id);
  }
}
