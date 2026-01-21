import { db, tasks, executions, usageRecords, repos } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { eachDayOfInterval, format } from "date-fns";

export interface AnalyticsDateRange {
  start: Date;
  end: Date;
}

export interface TaskMetrics {
  total: number;
  completed: number;
  executing: number;
  stuck: number;
  successRate: number;
  avgCompletionTimeMinutes: number | null;
}

export interface TasksByStatus {
  status: string;
  count: number;
}

export interface DailyCompletion {
  date: string;
  completed: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  avgPerTask: number;
}

export interface CostBreakdown {
  totalCents: number;
  inputCostCents: number;
  outputCostCents: number;
  avgPerTaskCents: number;
}

export interface RepoActivity {
  repoId: string;
  repoName: string;
  commits: number;
  tasksCompleted: number;
}

export async function getTaskMetrics(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<TaskMetrics> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map(r => r.id);

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
    where: (tasks, { inArray, and, gte, lte }) => and(
      inArray(tasks.repoId, repoIds),
      gte(tasks.createdAt, dateRange.start),
      lte(tasks.createdAt, dateRange.end)
    ),
  });

  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === "done").length;
  const executing = allTasks.filter(t => t.status === "executing").length;
  const stuck = allTasks.filter(t => t.status === "stuck").length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    executing,
    stuck,
    successRate,
    avgCompletionTimeMinutes: null, // TODO: calculate from executions
  };
}

export async function getTasksByStatus(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<TasksByStatus[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) return [];

  const allTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte }) => and(
      inArray(tasks.repoId, repoIds),
      gte(tasks.createdAt, dateRange.start),
      lte(tasks.createdAt, dateRange.end)
    ),
  });

  const statusCounts: Record<string, number> = {};
  allTasks.forEach(task => {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  });

  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));
}

export async function getDailyCompletions(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<DailyCompletion[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) return [];

  const completedTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte, eq }) => and(
      inArray(tasks.repoId, repoIds),
      eq(tasks.status, "done"),
      gte(tasks.updatedAt, dateRange.start),
      lte(tasks.updatedAt, dateRange.end)
    ),
  });

  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

  return days.map(day => {
    const dayStr = format(day, "yyyy-MM-dd");
    const count = completedTasks.filter(t =>
      format(t.updatedAt, "yyyy-MM-dd") === dayStr
    ).length;
    return { date: dayStr, completed: count };
  });
}

export async function getTokenUsage(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<TokenUsage> {
  const records = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.userId, userId),
      gte(usageRecords.createdAt, dateRange.start),
      lte(usageRecords.createdAt, dateRange.end)
    ),
  });

  const inputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
  const outputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
  const totalTokens = inputTokens + outputTokens;
  const avgPerTask = records.length > 0 ? Math.round(totalTokens / records.length) : 0;

  return { inputTokens, outputTokens, totalTokens, avgPerTask };
}

export async function getCostBreakdown(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<CostBreakdown> {
  const records = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.userId, userId),
      gte(usageRecords.createdAt, dateRange.start),
      lte(usageRecords.createdAt, dateRange.end)
    ),
  });

  const totalCents = records.reduce((sum, r) => sum + r.costCents, 0);
  // Approximate split (Claude pricing: input ~$3/M, output ~$15/M)
  const inputCostCents = Math.round(totalCents * 0.4);
  const outputCostCents = totalCents - inputCostCents;
  const avgPerTaskCents = records.length > 0 ? Math.round(totalCents / records.length) : 0;

  return { totalCents, inputCostCents, outputCostCents, avgPerTaskCents };
}

export async function getRepoActivity(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<RepoActivity[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });

  const results: RepoActivity[] = [];

  for (const repo of userRepos) {
    const repoTasks = await db.query.tasks.findMany({
      where: and(
        eq(tasks.repoId, repo.id),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end)
      ),
    });

    const completedTasks = repoTasks.filter(t => t.status === "done").length;

    // Count commits from executions
    const taskIds = repoTasks.map(t => t.id);
    let commits = 0;
    if (taskIds.length > 0) {
      const execs = await db.query.executions.findMany({
        where: (executions, { inArray }) => inArray(executions.taskId, taskIds),
      });
      commits = execs.reduce((sum, e) => sum + (e.commits?.length || 0), 0);
    }

    results.push({
      repoId: repo.id,
      repoName: repo.fullName,
      commits,
      tasksCompleted: completedTasks,
    });
  }

  return results;
}
