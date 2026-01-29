import { db, tasks, executions, repos, usageRecords } from "@/lib/db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
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

export interface RepoActivity {
  repoId: string;
  repoName: string;
  commits: number;
  tasksCompleted: number;
}

export interface TokenUsageMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}

export interface PhaseTokenBreakdown {
  brainstorm: TokenUsageMetrics;
  plan: TokenUsageMetrics;
  execution: TokenUsageMetrics;
  total: TokenUsageMetrics;
}

export interface CostBreakdown {
  byModel: Record<string, TokenUsageMetrics>;
  byPhase: PhaseTokenBreakdown;
  total: TokenUsageMetrics;
}

export async function getTaskMetrics(
  userId: string,
  dateRange: AnalyticsDateRange,
): Promise<TaskMetrics> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map((r) => r.id);

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
    where: (tasks, { inArray, and, gte, lte }) =>
      and(
        inArray(tasks.repoId, repoIds),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end),
      ),
  });

  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.status === "done").length;
  const executing = allTasks.filter((t) => t.status === "executing").length;
  const stuck = allTasks.filter((t) => t.status === "stuck").length;
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
  dateRange: AnalyticsDateRange,
): Promise<TasksByStatus[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map((r) => r.id);

  if (repoIds.length === 0) return [];

  const allTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte }) =>
      and(
        inArray(tasks.repoId, repoIds),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end),
      ),
  });

  const statusCounts: Record<string, number> = {};
  allTasks.forEach((task) => {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  });

  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));
}

export async function getDailyCompletions(
  userId: string,
  dateRange: AnalyticsDateRange,
): Promise<DailyCompletion[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map((r) => r.id);

  if (repoIds.length === 0) return [];

  const completedTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte, eq }) =>
      and(
        inArray(tasks.repoId, repoIds),
        eq(tasks.status, "done"),
        gte(tasks.updatedAt, dateRange.start),
        lte(tasks.updatedAt, dateRange.end),
      ),
  });

  // Pre-group tasks by date using Map for O(n) lookup instead of O(n*m)
  const tasksByDate = new Map<string, number>();
  for (const task of completedTasks) {
    const dateKey = format(task.updatedAt, "yyyy-MM-dd");
    tasksByDate.set(dateKey, (tasksByDate.get(dateKey) ?? 0) + 1);
  }

  const days = eachDayOfInterval({
    start: dateRange.start,
    end: dateRange.end,
  });

  return days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return { date: dayStr, completed: tasksByDate.get(dayStr) ?? 0 };
  });
}

export async function getRepoActivity(
  userId: string,
  dateRange: AnalyticsDateRange,
): Promise<RepoActivity[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });

  if (userRepos.length === 0) return [];

  const repoIds = userRepos.map((r) => r.id);

  // Batch query: Get all tasks across all repos in one query
  const allTasks = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.repoId, repoIds),
      gte(tasks.createdAt, dateRange.start),
      lte(tasks.createdAt, dateRange.end),
    ),
  });

  // Batch query: Get all executions for these tasks in one query
  const taskIds = allTasks.map((t) => t.id);
  const allExecs =
    taskIds.length > 0
      ? await db.query.executions.findMany({
          where: inArray(executions.taskId, taskIds),
        })
      : [];

  // Group tasks by repo in memory
  const tasksByRepo = new Map<string, typeof allTasks>();
  for (const task of allTasks) {
    const arr = tasksByRepo.get(task.repoId) ?? [];
    arr.push(task);
    tasksByRepo.set(task.repoId, arr);
  }

  // Group executions by task in memory
  const execsByTask = new Map<string, typeof allExecs>();
  for (const exec of allExecs) {
    const arr = execsByTask.get(exec.taskId) ?? [];
    arr.push(exec);
    execsByTask.set(exec.taskId, arr);
  }

  // Build results from in-memory data
  return userRepos.map((repo) => {
    const repoTasks = tasksByRepo.get(repo.id) ?? [];
    const completedTasks = repoTasks.filter((t) => t.status === "done").length;

    // Count commits from executions
    let commits = 0;
    for (const task of repoTasks) {
      const taskExecs = execsByTask.get(task.id) ?? [];
      commits += taskExecs.reduce(
        (sum, e) => sum + (e.commits?.length || 0),
        0,
      );
    }

    return {
      repoId: repo.id,
      repoName: repo.fullName,
      commits,
      tasksCompleted: completedTasks,
    };
  });
}

/**
 * Get token usage metrics for a user within a date range
 */
export async function getTokenUsage(
  userId: string,
  dateRange: AnalyticsDateRange,
): Promise<TokenUsageMetrics> {
  const records = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.userId, userId),
      gte(usageRecords.periodStart, dateRange.start),
      lte(usageRecords.periodEnd, dateRange.end),
    ),
  });

  const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
  const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
  const estimatedCostCents = records.reduce(
    (sum, r) => sum + r.estimatedCost,
    0,
  );

  return {
    totalTokens,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    estimatedCostCents,
  };
}

/**
 * Get cost breakdown by model and phase
 * Phase-specific data is tracked in execution.tokenMetrics (added in Task 2)
 */
export async function getCostBreakdown(
  userId: string,
  dateRange: AnalyticsDateRange,
): Promise<CostBreakdown> {
  const records = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.userId, userId),
      gte(usageRecords.periodStart, dateRange.start),
      lte(usageRecords.periodEnd, dateRange.end),
    ),
  });

  // Group by model
  const byModel: Record<string, TokenUsageMetrics> = {};
  for (const record of records) {
    if (!byModel[record.model]) {
      byModel[record.model] = {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostCents: 0,
      };
    }
    byModel[record.model].totalTokens += record.totalTokens;
    byModel[record.model].inputTokens += record.inputTokens;
    byModel[record.model].outputTokens += record.outputTokens;
    byModel[record.model].estimatedCostCents += record.estimatedCost;
  }

  // Initialize phase breakdown
  // TODO: Aggregate phase-specific metrics from execution.tokenMetrics
  const byPhase: PhaseTokenBreakdown = {
    brainstorm: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 0,
    },
    plan: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 0,
    },
    execution: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 0,
    },
    total: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCents: 0,
    },
  };

  // Aggregate totals
  for (const record of records) {
    byPhase.total.totalTokens += record.totalTokens;
    byPhase.total.inputTokens += record.inputTokens;
    byPhase.total.outputTokens += record.outputTokens;
    byPhase.total.estimatedCostCents += record.estimatedCost;
  }

  return {
    byModel,
    byPhase,
    total: byPhase.total,
  };
}
