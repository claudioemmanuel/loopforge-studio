/**
 * Billing Domain Types & Pure Helpers
 */

import type { BillingMode } from "@/lib/db/schema";

// =============================================================================
// Subscription Plans
// =============================================================================

export const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    priceId: process.env.STRIPE_PRICE_FREE || "",
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
    priceId: process.env.STRIPE_PRICE_PRO || "",
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
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || "",
    maxRepos: -1, // unlimited
    maxTasksPerRepo: -1, // unlimited
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
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS;

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
  resource: "repos" | "tasks",
) {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (resource === "repos") return plan.maxRepos === -1;
  return plan.maxTasksPerRepo === -1;
}

export function getLimit(
  tier: SubscriptionTier,
  resource: "repos" | "tasks",
): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (resource === "repos") return plan.maxRepos;
  return plan.maxTasksPerRepo;
}

export function getMaxReposForTier(tier: SubscriptionTier): number {
  return getPlanConfig(tier).maxRepos;
}

export function getMaxTasksForTier(tier: SubscriptionTier): number {
  return getPlanConfig(tier).maxTasksPerRepo;
}

export function formatLimitError(
  limitCheck: LimitCheckResult,
  resourceType: "repository" | "task",
): {
  error: string;
  message: string;
  current: number;
  limit: number;
  tier: string;
  upgradeUrl: string;
} {
  const resourcePlural =
    resourceType === "repository" ? "repositories" : "tasks";

  return {
    error: `${resourceType}_limit_reached`,
    message: `You've reached the limit of ${limitCheck.limit} ${resourcePlural} for the ${limitCheck.tier} plan. Upgrade to create more.`,
    current: limitCheck.current,
    limit: limitCheck.limit,
    tier: limitCheck.tier,
    upgradeUrl: "/billing",
  };
}

// =============================================================================
// Token Pricing
// =============================================================================

interface ModelPricing {
  inputPer1M: number; // cents per 1M input tokens
  outputPer1M: number; // cents per 1M output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic models
  "claude-sonnet-4-20250514": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-opus-4-20250514": { inputPer1M: 1500, outputPer1M: 7500 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-3-5-haiku-20241022": { inputPer1M: 80, outputPer1M: 400 },
  // OpenAI models
  "gpt-4o": { inputPer1M: 250, outputPer1M: 1000 },
  "gpt-4o-mini": { inputPer1M: 15, outputPer1M: 60 },
  "gpt-4-turbo": { inputPer1M: 1000, outputPer1M: 3000 },
  // Google models
  "gemini-2.5-pro": { inputPer1M: 125, outputPer1M: 500 },
  "gemini-2.0-flash": { inputPer1M: 10, outputPer1M: 40 },
  "gemini-1.5-pro": { inputPer1M: 125, outputPer1M: 500 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1M: 300, outputPer1M: 1500 };

/**
 * Calculate the cost of tokens for a given model.
 * @returns cost in cents
 */
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
// Usage Summary
// =============================================================================

export interface UsageSummary {
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
  estimatedCost: number; // cents
  billingMode: BillingMode;
  plan: {
    name: string;
    tier: string;
  } | null;
}
