/**
 * Usage Repository (Infrastructure Layer)
 *
 * Manages persistence of usage tracking aggregates.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { usageRecords } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  UsageTrackingAggregate,
  type UsageState,
} from "../domain/usage-aggregate";
import type { BillingPeriod, UsageSummary } from "../domain/types";

/**
 * Usage repository
 */
export class UsageRepository {
  constructor(private redis: Redis) {}

  /**
   * Find usage record by ID
   */
  async findById(id: string): Promise<UsageTrackingAggregate | null> {
    const [record] = await db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.id, id));

    if (!record) {
      return null;
    }

    // Extract provider from model name (e.g., "claude-sonnet-4" -> "anthropic")
    const provider = this.extractProviderFromModel(record.model);

    const state: UsageState = {
      id: record.id,
      userId: record.userId,
      executionId: record.executionId || "",
      tokensUsed: record.totalTokens,
      provider,
      model: record.model,
      recordedAt: record.createdAt,
    };

    return new UsageTrackingAggregate(state, this.redis);
  }

  /**
   * Save usage record
   */
  async save(usage: UsageTrackingAggregate): Promise<void> {
    const state = usage.getState();
    const now = new Date();

    // Map domain model to database schema
    await db.insert(usageRecords).values({
      id: state.id,
      userId: state.userId,
      taskId: null, // Not tracked at this level
      executionId:
        state.executionId && state.executionId !== ""
          ? state.executionId
          : null,
      periodStart: now, // Current period
      periodEnd: now,
      model: state.model,
      inputTokens: 0, // Not tracked separately in domain model
      outputTokens: 0,
      totalTokens: state.tokensUsed,
      estimatedCost: 0, // Calculate separately if needed
      createdAt: state.recordedAt,
    });
  }

  /**
   * Extract provider from model name
   */
  private extractProviderFromModel(model: string): string {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes("claude")) return "anthropic";
    if (lowerModel.includes("gpt")) return "openai";
    if (lowerModel.includes("gemini")) return "gemini";
    return "unknown";
  }

  /**
   * Find usage records for user in period
   */
  async findByUserInPeriod(
    userId: string,
    period: BillingPeriod,
  ): Promise<UsageTrackingAggregate[]> {
    const records = await db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, userId),
          gte(usageRecords.createdAt, period.start),
          lte(usageRecords.createdAt, period.end),
        ),
      )
      .orderBy(desc(usageRecords.createdAt));

    return records.map((record) => {
      const provider = this.extractProviderFromModel(record.model);

      const state: UsageState = {
        id: record.id,
        userId: record.userId,
        executionId: record.executionId || "",
        tokensUsed: record.totalTokens,
        provider,
        model: record.model,
        recordedAt: record.createdAt,
      };
      return new UsageTrackingAggregate(state, this.redis);
    });
  }

  /**
   * Get usage summary for user in period
   */
  async getSummary(
    userId: string,
    period: BillingPeriod,
  ): Promise<UsageSummary> {
    const records = await this.findByUserInPeriod(userId, period);

    const summary: UsageSummary = {
      totalTokens: 0,
      totalExecutions: 0,
      byProvider: {},
      byModel: {},
    };

    const uniqueExecutions = new Set<string>();

    for (const record of records) {
      const state = record.getState();
      summary.totalTokens += state.tokensUsed;

      // Count unique executions, but treat empty executionId as separate executions
      if (state.executionId && state.executionId !== "") {
        uniqueExecutions.add(state.executionId);
      } else {
        // Each record without an execution ID counts as a separate execution
        uniqueExecutions.add(state.id);
      }

      // Aggregate by provider
      if (!summary.byProvider[state.provider]) {
        summary.byProvider[state.provider] = 0;
      }
      summary.byProvider[state.provider] += state.tokensUsed;

      // Aggregate by model
      if (!summary.byModel[state.model]) {
        summary.byModel[state.model] = 0;
      }
      summary.byModel[state.model] += state.tokensUsed;
    }

    summary.totalExecutions = uniqueExecutions.size;

    return summary;
  }

  /**
   * Get current monthly token usage for user
   */
  async getCurrentMonthlyUsage(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const summary = await this.getSummary(userId, {
      start: startOfMonth,
      end: endOfMonth,
    });

    return summary.totalTokens;
  }
}
