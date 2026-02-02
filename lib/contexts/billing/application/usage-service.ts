/**
 * Usage Service (Application Layer)
 *
 * Orchestrates usage tracking operations and coordinates with infrastructure.
 * Subscribes to ExecutionCompleted events to automatically record usage.
 */

import type { Redis } from "ioredis";
import { UsageRepository } from "../infrastructure/usage-repository";
import { UsageTrackingAggregate } from "../domain/usage-aggregate";
import { randomUUID } from "crypto";
import type { BillingPeriod, UsageSummary } from "../domain/types";
import { getMonthlyBillingPeriod } from "../domain/types";

/**
 * Usage service
 */
export class UsageService {
  private usageRepository: UsageRepository;

  constructor(redis: Redis) {
    this.usageRepository = new UsageRepository(redis);
  }

  /**
   * Record usage
   */
  async recordUsage(params: {
    userId: string;
    executionId: string;
    tokensUsed: number;
    provider: string;
    model: string;
  }): Promise<{ usageId: string }> {
    const usageId = randomUUID();

    // Create usage aggregate
    const usage = await UsageTrackingAggregate.recordUsage(
      {
        id: usageId,
        userId: params.userId,
        executionId: params.executionId,
        tokensUsed: params.tokensUsed,
        provider: params.provider,
        model: params.model,
      },
      this.usageRepository["redis"],
    );

    // Persist
    await this.usageRepository.save(usage);

    return { usageId };
  }

  /**
   * Get usage summary for user in period
   */
  async getUsageSummary(params: {
    userId: string;
    period?: BillingPeriod;
  }): Promise<UsageSummary> {
    const period = params.period || getMonthlyBillingPeriod();
    return this.usageRepository.getSummary(params.userId, period);
  }

  /**
   * Get current monthly usage
   */
  async getCurrentMonthlyUsage(userId: string): Promise<number> {
    return this.usageRepository.getCurrentMonthlyUsage(userId);
  }

  /**
   * Get usage records for user in period
   */
  async getUsageRecords(params: {
    userId: string;
    period?: BillingPeriod;
  }): Promise<
    Array<{
      id: string;
      executionId: string;
      tokensUsed: number;
      provider: string;
      model: string;
      recordedAt: Date;
    }>
  > {
    const period = params.period || getMonthlyBillingPeriod();
    const records = await this.usageRepository.findByUserInPeriod(
      params.userId,
      period,
    );

    return records.map((record) => {
      const state = record.getState();
      return {
        id: state.id,
        executionId: state.executionId,
        tokensUsed: state.tokensUsed,
        provider: state.provider,
        model: state.model,
        recordedAt: state.recordedAt,
      };
    });
  }
}
