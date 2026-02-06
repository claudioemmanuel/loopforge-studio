/**
 * Billing Service (Application Layer)
 *
 * Orchestrates usage tracking and subscription management.
 */

import type { PlanLimits } from "@/lib/db/schema";
import type { UsageSummary, PlanTier, BillingPeriod } from "../domain/types";
import { calculateTokenCost } from "../domain/types";
import { SubscriptionRepository } from "../infrastructure/subscription-repository";
import { UsageRepository } from "../infrastructure/usage-repository";
import type { TaskService } from "../../task/application/task-service";
import type { RepositoryService } from "../../repository/application/repository-service";

export class BillingService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private usageRepository: UsageRepository,
    private taskService: TaskService,
    private repositoryService: RepositoryService,
  ) {}

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

    // Delegate to repository
    await this.usageRepository.recordUsage({
      userId,
      taskId,
      executionId,
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

    // Get subscription from repository
    const subscriptionAggregate =
      await this.subscriptionRepository.findByUserId(userId);

    if (!subscriptionAggregate) {
      throw new Error(`Subscription not found for user ${userId}`);
    }

    const subscriptionState = subscriptionAggregate.getState();
    const billingMode = subscriptionState.billingMode;
    const limits = subscriptionState.limits;

    // Get usage from repository
    const usageSummaryData = await this.usageRepository.getSummary(userId, {
      start: periodStart,
      end: periodEnd,
    });

    // Get counts from delegated services
    const reposCount = await this.repositoryService.countByUser(userId);
    const tasksCreated = await this.taskService.countByUser(userId);

    const tokensUsed = usageSummaryData.totalTokens;

    // Get estimated cost from repository
    const estimatedCost = await this.usageRepository.getEstimatedCost(userId, {
      start: periodStart,
      end: periodEnd,
    });

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
      estimatedCost,
      billingMode,
      plan: {
        name: subscriptionState.planTier,
        tier: subscriptionState.planTier,
      },
    };
  }

  // =========================================================================
  // Subscription management
  // =========================================================================

  /**
   * Upgrade a user's subscription to a higher tier.
   */
  async upgradeSubscription(userId: string, newTier: PlanTier): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new Error(`Subscription not found for user ${userId}`);
    }

    await subscription.upgrade(newTier);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Downgrade a user's subscription to a lower tier.
   */
  async downgradeSubscription(
    userId: string,
    newTier: PlanTier,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new Error(`Subscription not found for user ${userId}`);
    }

    await subscription.downgrade(newTier);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancel a user's subscription.
   */
  async cancelSubscription(userId: string, reason?: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new Error(`Subscription not found for user ${userId}`);
    }

    await subscription.cancel(reason);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Check if user is within subscription limits.
   * Delegates counts to owning services.
   */
  async checkLimits(
    userId: string,
  ): Promise<{ withinLimits: boolean; usage: LimitUsage }> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new Error(`Subscription not found for user ${userId}`);
    }

    const limits = subscription.getLimits();

    // Delegate to owning services
    const taskCount = await this.taskService.countByUser(userId);
    const repoCount = await this.repositoryService.countByUser(userId);
    const tokenCount =
      await this.usageRepository.getCurrentMonthlyUsage(userId);

    return {
      withinLimits:
        taskCount <= limits.maxTasksPerMonth &&
        repoCount <= limits.maxRepos &&
        tokenCount <= limits.maxTokensPerMonth,
      usage: {
        tasks: taskCount,
        repos: repoCount,
        tokens: tokenCount,
        limits,
      },
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

/** Limit usage data */
interface LimitUsage {
  tasks: number;
  repos: number;
  tokens: number;
  limits: PlanLimits;
}
