/**
 * Integration tests for AnalyticsService (current DDD contract).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  activityEvents,
  executions,
  repos,
  tasks,
  usageRecords,
  users,
} from "@/lib/db/schema";
import { Redis } from "ioredis";
import { AnalyticsService } from "@/lib/contexts/analytics/application/analytics-service";

describe("AnalyticsService Integration", () => {
  let analyticsService: AnalyticsService;
  let userId: string;
  let repoId: string;
  let taskId: string;
  let executionId: string;

  beforeEach(async () => {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    analyticsService = new AnalyticsService(redis);

    const unique = `${Date.now()}-${Math.random()}`;

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      githubId: `gh-${unique}`,
      username: `user-${unique}`,
      email: `user-${unique}@example.com`,
    });

    repoId = randomUUID();
    await db.insert(repos).values({
      id: repoId,
      userId,
      githubRepoId: `repo-${unique}`,
      name: "test-repo",
      fullName: `owner/test-repo-${unique}`,
      cloneUrl: "https://github.com/owner/test-repo.git",
      defaultBranch: "main",
    });

    taskId = randomUUID();
    await db.insert(tasks).values({
      id: taskId,
      repoId,
      title: "Analytics Task",
      status: "todo",
      autonomousMode: true,
    });

    executionId = randomUUID();
    await db.insert(executions).values({
      id: executionId,
      taskId,
      status: "completed",
      commits: ["abc123", "def456"],
      startedAt: new Date(),
      completedAt: new Date(),
    });
  });

  it("records activity events and exposes them in feed/history queries", async () => {
    await analyticsService.recordActivityEvent({
      taskId,
      repoId,
      userId,
      executionId,
      eventType: "execution_complete",
      eventCategory: "system",
      title: "Execution completed",
      content: "Completed task execution",
      metadata: { branch: "loopforge/task-1" },
    });

    await analyticsService.recordActivityEvent({
      taskId,
      repoId,
      userId,
      eventType: "commit_created",
      eventCategory: "git",
      title: "Commit created",
      content: "feat: implement endpoint",
    });

    const feed = await analyticsService.getActivityFeed(repoId, 10);
    const history = await analyticsService.getActivityHistory(repoId, 10);
    const changes = await analyticsService.getActivityChanges(repoId, 10);

    expect(feed.length).toBeGreaterThanOrEqual(2);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes.every((row) => row.eventType === "commit_created")).toBe(
      true,
    );
  });

  it("computes task metrics and daily completions from repository tasks", async () => {
    await db.insert(tasks).values([
      {
        id: randomUUID(),
        repoId,
        title: "Done task",
        status: "done",
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        repoId,
        title: "Executing task",
        status: "executing",
      },
      {
        id: randomUUID(),
        repoId,
        title: "Stuck task",
        status: "stuck",
      },
    ]);

    const dateRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const metrics = await analyticsService.getTaskMetrics(userId, dateRange);
    const byStatus = await analyticsService.getTasksByStatus(userId, dateRange);
    const daily = await analyticsService.getDailyCompletions(userId, dateRange);
    const repoActivity = await analyticsService.getRepoActivity(
      userId,
      dateRange,
    );

    expect(metrics.total).toBeGreaterThanOrEqual(4);
    expect(metrics.completed).toBeGreaterThanOrEqual(1);
    expect(metrics.executing).toBeGreaterThanOrEqual(1);
    expect(metrics.stuck).toBeGreaterThanOrEqual(1);
    expect(byStatus.some((item) => item.status === "done")).toBe(true);
    expect(daily.length).toBeGreaterThan(0);
    expect(repoActivity.length).toBeGreaterThan(0);
  });

  it("aggregates token usage and cost breakdown by model", async () => {
    const now = new Date();
    await db.insert(usageRecords).values([
      {
        id: randomUUID(),
        userId,
        taskId,
        executionId,
        periodStart: new Date(now.getTime() - 1000),
        periodEnd: new Date(now.getTime() + 1000),
        model: "claude-sonnet-4-20250514",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 42,
      },
      {
        id: randomUUID(),
        userId,
        taskId,
        executionId,
        periodStart: new Date(now.getTime() - 1000),
        periodEnd: new Date(now.getTime() + 1000),
        model: "gpt-4o",
        inputTokens: 600,
        outputTokens: 300,
        totalTokens: 900,
        estimatedCost: 25,
      },
    ]);

    const dateRange = {
      start: new Date(now.getTime() - 10_000),
      end: new Date(now.getTime() + 10_000),
    };

    const usage = await analyticsService.getTokenUsage(userId, dateRange);
    const costs = await analyticsService.getCostBreakdown(userId, dateRange);

    expect(usage.totalTokens).toBe(2400);
    expect(usage.inputTokens).toBe(1600);
    expect(usage.outputTokens).toBe(800);
    expect(usage.estimatedCostCents).toBe(67);
    expect(costs.byModel["claude-sonnet-4-20250514"].totalTokens).toBe(1500);
    expect(costs.byModel["gpt-4o"].estimatedCostCents).toBe(25);
    expect(costs.total.estimatedCostCents).toBe(67);
  });

  it("deletes user activities for account cleanup", async () => {
    await db.insert(activityEvents).values({
      id: randomUUID(),
      userId,
      taskId,
      repoId,
      eventType: "task_created",
      eventCategory: "system",
      title: "Task created",
      content: "Created task",
    });

    let rows = await db.query.activityEvents.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
    });
    expect(rows.length).toBeGreaterThan(0);

    await analyticsService.deleteUserActivities(userId);

    rows = await db.query.activityEvents.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
    });
    expect(rows.length).toBe(0);
  });
});
