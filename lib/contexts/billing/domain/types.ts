/**
 * Billing Domain Types
 *
 * Value objects and types for the Billing context.
 */

/**
 * Plan tier
 */
export type PlanTier = "free" | "pro" | "enterprise";

/**
 * Billing mode
 */
export type BillingMode = "byok" | "managed";

/**
 * Subscription status
 */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";

/**
 * Plan limits
 */
export interface PlanLimits {
  maxRepos: number; // -1 = unlimited
  maxTasks: number; // -1 = unlimited
  maxTokensPerMonth: number; // -1 = unlimited
}

/**
 * Plan configuration
 */
export interface PlanConfig {
  tier: PlanTier;
  name: string;
  limits: PlanLimits;
  priceMonthly: number; // In cents (0 for free)
  priceYearly: number; // In cents (0 for free)
}

/**
 * Plan configurations
 */
export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    name: "Free",
    limits: {
      maxRepos: 1,
      maxTasks: 5,
      maxTokensPerMonth: 100000, // 100K tokens/month
    },
    priceMonthly: 0,
    priceYearly: 0,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    limits: {
      maxRepos: 20,
      maxTasks: 100,
      maxTokensPerMonth: 5000000, // 5M tokens/month
    },
    priceMonthly: 2900, // $29/month
    priceYearly: 29000, // $290/year (2 months free)
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    limits: {
      maxRepos: -1, // Unlimited
      maxTasks: -1, // Unlimited
      maxTokensPerMonth: -1, // Unlimited
    },
    priceMonthly: 9900, // $99/month
    priceYearly: 99000, // $990/year (2 months free)
  },
};

/**
 * Usage record
 */
export interface UsageRecord {
  id: string;
  userId: string;
  executionId: string;
  tokensUsed: number;
  provider: string; // anthropic | openai | gemini
  model: string;
  recordedAt: Date;
}

/**
 * Billing period
 */
export interface BillingPeriod {
  start: Date;
  end: Date;
}

/**
 * Usage summary
 */
export interface UsageSummary {
  totalTokens: number;
  totalExecutions: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

/**
 * Check if limit is unlimited
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Check if limit is exceeded
 */
export function isLimitExceeded(currentValue: number, limit: number): boolean {
  if (isUnlimited(limit)) {
    return false;
  }
  return currentValue >= limit;
}

/**
 * Get plan config for tier
 */
export function getPlanConfig(tier: PlanTier): PlanConfig {
  return PLAN_CONFIGS[tier];
}

/**
 * Calculate billing period (monthly)
 */
export function getMonthlyBillingPeriod(
  date: Date = new Date(),
): BillingPeriod {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}
