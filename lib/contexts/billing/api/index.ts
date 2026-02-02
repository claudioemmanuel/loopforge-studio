/**
 * Billing Context API
 *
 * Public API for interacting with the Billing bounded context.
 * Provides backward-compatible interface for existing code.
 */

import { Redis } from "ioredis";
import { BillingService } from "../application/billing-service";
import { UsageService } from "../application/usage-service";
import type {
  PlanTier,
  BillingMode,
  PlanLimits,
  BillingPeriod,
  UsageSummary,
} from "../domain/types";

// Singleton Redis instance for Billing context
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(
      process.env.REDIS_URL || "redis://localhost:6379",
    );
  }
  return redisInstance;
}

// Singleton service instances
let billingServiceInstance: BillingService | null = null;
let usageServiceInstance: UsageService | null = null;

/**
 * Get billing service instance
 */
export function getBillingService(): BillingService {
  if (!billingServiceInstance) {
    billingServiceInstance = new BillingService(getRedis());
  }
  return billingServiceInstance;
}

/**
 * Get usage service instance
 */
export function getUsageService(): UsageService {
  if (!usageServiceInstance) {
    usageServiceInstance = new UsageService(getRedis());
  }
  return usageServiceInstance;
}

/**
 * Create subscription for user (typically called during onboarding)
 */
export async function createUserSubscription(params: {
  userId: string;
  planTier?: PlanTier;
  billingMode?: BillingMode;
}): Promise<{ subscriptionId: string }> {
  const billingService = getBillingService();
  return billingService.createSubscription(params);
}

/**
 * Get user subscription details
 */
export async function getUserSubscription(userId: string): Promise<{
  id: string;
  userId: string;
  planTier: PlanTier;
  billingMode: BillingMode;
  status: string;
  limits: PlanLimits;
  isActive: boolean;
  isByok: boolean;
} | null> {
  const billingService = getBillingService();
  return billingService.getSubscription(userId);
}

/**
 * Upgrade user subscription
 */
export async function upgradeUserSubscription(params: {
  userId: string;
  newTier: PlanTier;
}): Promise<void> {
  const billingService = getBillingService();
  return billingService.upgradeSubscription(params);
}

/**
 * Downgrade user subscription
 */
export async function downgradeUserSubscription(params: {
  userId: string;
  newTier: PlanTier;
}): Promise<void> {
  const billingService = getBillingService();
  return billingService.downgradeSubscription(params);
}

/**
 * Cancel user subscription
 */
export async function cancelUserSubscription(params: {
  userId: string;
  reason?: string;
}): Promise<void> {
  const billingService = getBillingService();
  return billingService.cancelSubscription(params);
}

/**
 * Check if user has exceeded a limit
 */
export async function checkUserLimit(params: {
  userId: string;
  limitType: "maxRepos" | "maxTasks" | "maxTokensPerMonth";
  currentValue: number;
}): Promise<boolean> {
  const billingService = getBillingService();
  return billingService.checkLimit(params);
}

/**
 * Record usage for an execution
 */
export async function recordExecutionUsage(params: {
  userId: string;
  executionId: string;
  tokensUsed: number;
  provider: string;
  model: string;
}): Promise<{ usageId: string }> {
  const usageService = getUsageService();
  return usageService.recordUsage(params);
}

/**
 * Get usage summary for user
 */
export async function getUserUsageSummary(params: {
  userId: string;
  period?: BillingPeriod;
}): Promise<UsageSummary> {
  const usageService = getUsageService();
  return usageService.getUsageSummary(params);
}

/**
 * Get current monthly token usage
 */
export async function getCurrentMonthlyTokenUsage(
  userId: string,
): Promise<number> {
  const usageService = getUsageService();
  return usageService.getCurrentMonthlyUsage(userId);
}

/**
 * Get usage records for user
 */
export async function getUserUsageRecords(params: {
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
  const usageService = getUsageService();
  return usageService.getUsageRecords(params);
}

// Re-export domain types for convenience
export type { PlanTier, BillingMode, PlanLimits, BillingPeriod, UsageSummary };
export {
  getPlanConfig,
  isUnlimited,
  isLimitExceeded,
  getMonthlyBillingPeriod,
} from "../domain/types";
