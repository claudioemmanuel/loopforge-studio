/**
 * Billing Domain Types & Pure Helpers
 */

import type {
  BillingMode as DbBillingMode,
  PlanLimits as DbPlanLimits,
  SubscriptionStatus as DbSubscriptionStatus,
} from "@/lib/db/schema";

export type PlanTier = "free" | "pro" | "enterprise";
export type SubscriptionTier = PlanTier;
export type BillingMode = DbBillingMode;
export type SubscriptionStatus = DbSubscriptionStatus;
export type PlanLimits = DbPlanLimits;

export interface BillingPeriod {
  start: Date;
  end: Date;
}

// =============================================================================
// Subscription Plans
// =============================================================================

export const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    limits: {
      maxRepos: 1,
      maxTasksPerMonth: 10,
      maxTokensPerMonth: 100_000,
    },
    maxRepos: 1,
    maxTasksPerRepo: 10,
    features: [
      "Basic AI assistance",
      "1 repository",
      "Up to 10 tasks per repository",
      "Community support",
    ],
  },
  pro: {
    name: "Pro",
    limits: {
      maxRepos: 20,
      maxTasksPerMonth: 100,
      maxTokensPerMonth: 5_000_000,
    },
    maxRepos: 20,
    maxTasksPerRepo: 100,
    features: [
      "Advanced AI models",
      "Priority execution",
      "Up to 20 repositories",
      "Up to 100 tasks per repository",
      "Email support",
      "Custom workflows",
    ],
  },
  enterprise: {
    name: "Enterprise",
    limits: {
      maxRepos: -1,
      maxTasksPerMonth: -1,
      maxTokensPerMonth: -1,
    },
    maxRepos: -1,
    maxTasksPerRepo: -1,
    features: [
      "Unlimited repositories",
      "Unlimited tasks",
      "Dedicated support",
      "Custom AI models",
      "SSO authentication",
      "Advanced analytics",
      "SLA guarantee",
    ],
  },
} as const satisfies Record<
  PlanTier,
  {
    name: string;
    limits: PlanLimits;
    maxRepos: number;
    maxTasksPerRepo: number;
    features: readonly string[];
  }
>;

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
  upgradeRequired: boolean;
}

export function getPlanConfig(tier: SubscriptionTier) {
  return SUBSCRIPTION_PLANS[tier];
}

export function isUnlimited(
  tier: SubscriptionTier,
  resource: "repos" | "tasks" | "tokens",
) {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (resource === "repos") return plan.limits.maxRepos === -1;
  if (resource === "tasks") return plan.limits.maxTasksPerMonth === -1;
  return plan.limits.maxTokensPerMonth === -1;
}

export function getLimit(
  tier: SubscriptionTier,
  resource: "repos" | "tasks" | "tokens",
): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (resource === "repos") return plan.limits.maxRepos;
  if (resource === "tasks") return plan.limits.maxTasksPerMonth;
  return plan.limits.maxTokensPerMonth;
}

export function getMaxReposForTier(tier: SubscriptionTier): number {
  return getPlanConfig(tier).limits.maxRepos;
}

export function getMaxTasksForTier(tier: SubscriptionTier): number {
  return getPlanConfig(tier).limits.maxTasksPerMonth;
}

export function isLimitExceeded(current: number, limit: number): boolean {
  if (limit < 0) return false;
  return current >= limit;
}

export function getMonthlyBillingPeriod(reference = new Date()): BillingPeriod {
  const start = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  );

  return { start, end };
}

// =============================================================================
// Token Pricing
// =============================================================================

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-20250514": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-opus-4-20250514": { inputPer1M: 1500, outputPer1M: 7500 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-3-5-haiku-20241022": { inputPer1M: 80, outputPer1M: 400 },
  "gpt-4o": { inputPer1M: 250, outputPer1M: 1000 },
  "gpt-4o-mini": { inputPer1M: 15, outputPer1M: 60 },
  "gpt-4-turbo": { inputPer1M: 1000, outputPer1M: 3000 },
  "gemini-2.5-pro": { inputPer1M: 125, outputPer1M: 500 },
  "gemini-2.0-flash": { inputPer1M: 10, outputPer1M: 40 },
  "gemini-1.5-pro": { inputPer1M: 125, outputPer1M: 500 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1M: 300, outputPer1M: 1500 };

export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.ceil(inputCost + outputCost);
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// =============================================================================
// Usage Shapes
// =============================================================================

export interface UsageSummary {
  totalTokens: number;
  totalExecutions: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

export interface BillingUsageSummary {
  currentPeriod: {
    start: Date;
    end: Date;
  };
  tokens: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  tasks: {
    created: number;
    limit: number;
    percentUsed: number;
  };
  repos: {
    count: number;
    limit: number;
    percentUsed: number;
  };
  estimatedCost: number;
  billingMode: BillingMode;
  plan: {
    name: string;
    tier: string;
  } | null;
}

export interface UsageRecord {
  id: string;
  userId: string;
  executionId: string;
  tokensUsed: number;
  provider: string;
  model: string;
  recordedAt: Date;
}
