/**
 * Activity Repository (Infrastructure Layer)
 *
 * Manages persistence and querying of activity events.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { activityEvents, activitySummaries } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import type {
  ActivityEvent,
  ActivityFilter,
  ActivitySummary,
  SummaryFilter,
  ActivityMetrics,
  TimePeriod,
} from "../domain/types";
import { getTimeRange } from "../domain/types";

/**
 * Activity repository
 */
export class ActivityRepository {
  constructor(private redis: Redis) {}

  /**
   * Record a new activity event
   */
  async recordActivity(params: {
    taskId?: string;
    repoId?: string;
    userId: string;
    executionId?: string;
    eventType: string;
    eventCategory: "ai_action" | "git" | "system";
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
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

  /**
   * Find activity events by filter
   */
  async findActivities(filter: ActivityFilter): Promise<ActivityEvent[]> {
    const conditions = [];

    if (filter.userId) {
      conditions.push(eq(activityEvents.userId, filter.userId));
    }
    if (filter.repoId) {
      conditions.push(eq(activityEvents.repoId, filter.repoId));
    }
    if (filter.taskId) {
      conditions.push(eq(activityEvents.taskId, filter.taskId));
    }
    if (filter.executionId) {
      conditions.push(eq(activityEvents.executionId, filter.executionId));
    }
    if (filter.category) {
      conditions.push(eq(activityEvents.eventCategory, filter.category));
    }
    if (filter.startDate) {
      conditions.push(gte(activityEvents.createdAt, filter.startDate));
    }
    if (filter.endDate) {
      conditions.push(lte(activityEvents.createdAt, filter.endDate));
    }

    const query = db
      .select()
      .from(activityEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityEvents.createdAt))
      .limit(filter.limit || 100);

    const records = await query;

    return records.map((record) => ({
      id: record.id,
      userId: record.userId || undefined,
      taskId: record.taskId || undefined,
      repoId: record.repoId || undefined,
      executionId: record.executionId || undefined,
      eventType: record.eventType,
      category: record.eventCategory as ActivityEvent["category"],
      title: record.title,
      content: record.content || undefined,
      metadata: (record.metadata as Record<string, unknown>) || undefined,
      createdAt: record.createdAt,
    }));
  }

  /**
   * Find recent activities for user
   */
  async findRecentActivities(
    userId: string,
    limit: number = 50,
  ): Promise<ActivityEvent[]> {
    return this.findActivities({ userId, limit });
  }

  /**
   * Find summaries by filter
   */
  async findSummaries(filter: SummaryFilter): Promise<ActivitySummary[]> {
    const conditions = [];

    if (filter.userId) {
      conditions.push(eq(activitySummaries.userId, filter.userId));
    }
    if (filter.repoId) {
      conditions.push(eq(activitySummaries.repoId, filter.repoId));
    }
    if (filter.startDate) {
      conditions.push(gte(activitySummaries.date, filter.startDate));
    }
    if (filter.endDate) {
      conditions.push(lte(activitySummaries.date, filter.endDate));
    }

    const records = await db
      .select()
      .from(activitySummaries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activitySummaries.date))
      .limit(30);

    return records.map((record) => ({
      id: record.id,
      userId: record.userId || "",
      repoId: record.repoId || undefined,
      date: record.date,
      tasksCompleted: record.tasksCompleted || 0,
      tasksFailed: record.tasksFailed || 0,
      commits: record.commits || 0,
      filesChanged: record.filesChanged || 0,
      tokensUsed: record.tokensUsed || 0,
      summaryText: record.summaryText || undefined,
      createdAt: record.createdAt,
    }));
  }

  /**
   * Generate daily summary for user
   */
  async generateDailySummary(
    userId: string,
    date: Date = new Date(),
  ): Promise<ActivitySummary> {
    const { start, end } = getTimeRange("day", date);

    // Aggregate activity metrics for the day
    const activities = await this.findActivities({
      userId,
      startDate: start,
      endDate: end,
    });

    // Count tasks completed/failed
    const tasksCompleted = activities.filter(
      (a) => a.eventType === "ExecutionCompleted",
    ).length;
    const tasksFailed = activities.filter(
      (a) => a.eventType === "ExecutionFailed",
    ).length;

    // Count commits
    const commits = activities.filter(
      (a) => a.eventType === "CommitCreated",
    ).length;

    // Count files changed (sum from commit metadata)
    const filesChanged = activities
      .filter((a) => a.eventType === "CommitCreated")
      .reduce((sum, a) => sum + ((a.metadata?.filesChanged as number) || 0), 0);

    // Count tokens used (sum from usage metadata)
    const tokensUsed = activities
      .filter((a) => a.eventType === "UsageRecorded")
      .reduce((sum, a) => sum + ((a.metadata?.tokensUsed as number) || 0), 0);

    // Generate summary text
    const summaryText = this.generateSummaryText({
      tasksCompleted,
      tasksFailed,
      commits,
      filesChanged,
      tokensUsed,
    });

    // Save summary
    const [summary] = await db
      .insert(activitySummaries)
      .values({
        id: crypto.randomUUID(),
        userId,
        repoId: null,
        date: start,
        tasksCompleted,
        tasksFailed,
        commits,
        filesChanged,
        tokensUsed,
        summaryText,
        createdAt: new Date(),
      })
      .returning();

    return {
      id: summary.id,
      userId: summary.userId || "",
      repoId: summary.repoId || undefined,
      date: summary.date,
      tasksCompleted: summary.tasksCompleted || 0,
      tasksFailed: summary.tasksFailed || 0,
      commits: summary.commits || 0,
      filesChanged: summary.filesChanged || 0,
      tokensUsed: summary.tokensUsed || 0,
      summaryText: summary.summaryText || undefined,
      createdAt: summary.createdAt,
    };
  }

  /**
   * Generate summary text
   */
  private generateSummaryText(metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    commits: number;
    filesChanged: number;
    tokensUsed: number;
  }): string {
    const parts = [];

    if (metrics.tasksCompleted > 0) {
      parts.push(
        `Completed ${metrics.tasksCompleted} task${metrics.tasksCompleted === 1 ? "" : "s"}`,
      );
    }

    if (metrics.commits > 0) {
      parts.push(
        `${metrics.commits} commit${metrics.commits === 1 ? "" : "s"}`,
      );
    }

    if (metrics.filesChanged > 0) {
      parts.push(`${metrics.filesChanged} files changed`);
    }

    if (metrics.tokensUsed > 0) {
      const tokensFormatted =
        metrics.tokensUsed >= 1000
          ? `${Math.round(metrics.tokensUsed / 1000)}K`
          : metrics.tokensUsed.toString();
      parts.push(`${tokensFormatted} tokens used`);
    }

    if (parts.length === 0) {
      return "No activity";
    }

    return parts.join(", ");
  }

  /**
   * Get activity metrics
   */
  async getMetrics(
    userId: string,
    period: TimePeriod = "week",
  ): Promise<ActivityMetrics> {
    const { start, end } = getTimeRange(period);

    const activities = await this.findActivities({
      userId,
      startDate: start,
      endDate: end,
    });

    // Count by category
    const activitiesByCategory: Record<string, number> = {
      ai_action: 0,
      git: 0,
      system: 0,
      test: 0,
      review: 0,
    };

    activities.forEach((a) => {
      activitiesByCategory[a.category] =
        (activitiesByCategory[a.category] || 0) + 1;
    });

    // Count by day
    const activitiesByDay: Map<string, number> = new Map();
    activities.forEach((a) => {
      const dateKey = a.createdAt.toISOString().split("T")[0];
      activitiesByDay.set(dateKey, (activitiesByDay.get(dateKey) || 0) + 1);
    });

    const activitiesByDayArray = Array.from(activitiesByDay.entries()).map(
      ([dateStr, count]) => ({
        date: new Date(dateStr),
        count,
      }),
    );

    // Top tasks (by activity count)
    const taskCounts: Map<
      string,
      { taskId: string; title: string; count: number }
    > = new Map();
    activities.forEach((a) => {
      if (a.taskId) {
        const existing = taskCounts.get(a.taskId);
        if (existing) {
          existing.count++;
        } else {
          taskCounts.set(a.taskId, {
            taskId: a.taskId,
            title: a.title,
            count: 1,
          });
        }
      }
    });

    const topTasks = Array.from(taskCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => ({
        taskId: t.taskId,
        title: t.title,
        activityCount: t.count,
      }));

    // Top repos
    const repoCounts: Map<
      string,
      { repoId: string; name: string; count: number }
    > = new Map();
    activities.forEach((a) => {
      if (a.repoId) {
        const existing = repoCounts.get(a.repoId);
        if (existing) {
          existing.count++;
        } else {
          repoCounts.set(a.repoId, {
            repoId: a.repoId,
            name: "", // Would need to join with repos table
            count: 1,
          });
        }
      }
    });

    const topRepos = Array.from(repoCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((r) => ({ repoId: r.repoId, name: r.name, activityCount: r.count }));

    return {
      totalActivities: activities.length,
      activitiesByCategory: activitiesByCategory as Record<
        ActivityEvent["category"],
        number
      >,
      activitiesByDay: activitiesByDayArray,
      topTasks,
      topRepos,
    };
  }
}
