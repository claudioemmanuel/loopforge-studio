/**
 * Billing Service (Application Layer)
 *
 * Orchestrates usage tracking for the local deployment.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users, repos, tasks, usageRecords } from "@/lib/db/schema";
import { eq, and, gte, lte, count, sum } from "drizzle-orm";
import type { PlanLimits } from "@/lib/db/schema";
import { calculateTokenCost, type UsageSummary } from "../domain/types";

export class BillingService {
  // Redis kept for future event publishing; unused today.
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  // =========================================================================
  // Usage tracking
  // =========================================================================

  /** Record token usage for a completed AI call. */
  async recordUsage(params: {
    userId: string;
    taskId?: string;
    executionId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    const { userId, taskId, executionId, model, inputTokens, outputTokens } =
      params;

    const { periodStart, periodEnd } = getCurrentBillingPeriod();
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateTokenCost(model, inputTokens, outputTokens);

    await db.insert(usageRecords).values({
      userId,
      taskId: taskId || null,
      executionId: executionId || null,
      periodStart,
      periodEnd,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
    });
  }

  /** Get the current-period usage summary for a user. */
  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const { periodStart, periodEnd } = getCurrentBillingPeriod();

    const userWithSubscription = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        subscription: {
          with: {
            plan: true,
          },
        },
      },
    });

    const billingMode = userWithSubscription?.billingMode || "byok";
    const subscription = userWithSubscription?.subscription;
    const plan = subscription?.plan;

    const limits: PlanLimits = plan?.limits || {
      maxRepos: -1,
      maxTasksPerMonth: -1,
      maxTokensPerMonth: -1,
    };

    const tokenUsage = await db
      .select({
        totalTokens: sum(usageRecords.totalTokens),
        estimatedCost: sum(usageRecords.estimatedCost),
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, userId),
          gte(usageRecords.periodStart, periodStart),
          lte(usageRecords.periodEnd, periodEnd),
        ),
      );

    const taskCount = await db
      .select({ count: count() })
      .from(tasks)
      .innerJoin(repos, eq(tasks.repoId, repos.id))
      .where(
        and(
          eq(repos.userId, userId),
          gte(tasks.createdAt, periodStart),
          lte(tasks.createdAt, periodEnd),
        ),
      );

    const repoCount = await db
      .select({ count: count() })
      .from(repos)
      .where(eq(repos.userId, userId));

    const tokensUsed = Number(tokenUsage[0]?.totalTokens) || 0;
    const tasksCreated = taskCount[0]?.count || 0;
    const reposCount = repoCount[0]?.count || 0;

    return {
      currentPeriod: {
        start: periodStart,
        end: periodEnd,
      },
      tokens: {
        used: tokensUsed,
        limit: limits.maxTokensPerMonth,
        percentUsed: Math.min(
          (tokensUsed / limits.maxTokensPerMonth) * 100,
          100,
        ),
      },
      tasks: {
        created: tasksCreated,
        limit: limits.maxTasksPerMonth,
        percentUsed: Math.min(
          (tasksCreated / limits.maxTasksPerMonth) * 100,
          100,
        ),
      },
      repos: {
        count: reposCount,
        limit: limits.maxRepos,
        percentUsed: Math.min((reposCount / limits.maxRepos) * 100, 100),
      },
      estimatedCost: Number(tokenUsage[0]?.estimatedCost) || 0,
      billingMode,
      plan: plan
        ? {
            name: plan.name,
            tier: plan.tier,
          }
        : null,
    };
  }
}

/** Get the current billing period (monthly, aligned to first of month). */
function getCurrentBillingPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { periodStart, periodEnd };
}
