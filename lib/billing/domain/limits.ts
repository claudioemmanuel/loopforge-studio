/**
 * Subscription tier limits and checks.
 */

import { db, users, repos, tasks } from "@/lib/db";
import { eq, count } from "drizzle-orm";

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

/**
 * Get plan configuration by tier.
 */
export function getPlanConfig(tier: SubscriptionTier) {
  return SUBSCRIPTION_PLANS[tier];
}

/**
 * Check if a tier allows unlimited resources.
 */
export function isUnlimited(
  tier: SubscriptionTier,
  resource: "repos" | "tasks",
) {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (resource === "repos") return plan.maxRepos === -1;
  return plan.maxTasksPerRepo === -1;
}

/**
 * Get limit for a tier and resource type.
 */
export function getLimit(
  tier: SubscriptionTier,
  resource: "repos" | "tasks",
): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (resource === "repos") return plan.maxRepos;
  return plan.maxTasksPerRepo;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
  upgradeRequired: boolean;
}

/**
 * Check if user can create more repositories.
 */
export async function checkRepoLimit(
  userId: string,
): Promise<LimitCheckResult> {
  // Get user's subscription tier
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const tier = (user?.subscriptionTier || "free") as SubscriptionTier;
  const plan = getPlanConfig(tier);
  const maxRepos = plan.maxRepos;

  // Count current repositories
  const repoCount = await db
    .select({ count: count() })
    .from(repos)
    .where(eq(repos.userId, userId));

  const current = repoCount[0]?.count || 0;

  // Unlimited check
  if (maxRepos === -1) {
    return {
      allowed: true,
      current,
      limit: -1,
      tier,
      upgradeRequired: false,
    };
  }

  return {
    allowed: current < maxRepos,
    current,
    limit: maxRepos,
    tier,
    upgradeRequired: current >= maxRepos,
  };
}

/**
 * Check if user can create more tasks in a repository.
 */
export async function checkTaskLimit(
  userId: string,
  repoId: string,
): Promise<LimitCheckResult> {
  // Get user's subscription tier
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const tier = (user?.subscriptionTier || "free") as SubscriptionTier;
  const plan = getPlanConfig(tier);
  const maxTasks = plan.maxTasksPerRepo;

  // Count current tasks in this repo
  const taskCount = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.repoId, repoId));

  const current = taskCount[0]?.count || 0;

  // Unlimited check
  if (maxTasks === -1) {
    return {
      allowed: true,
      current,
      limit: -1,
      tier,
      upgradeRequired: false,
    };
  }

  return {
    allowed: current < maxTasks,
    current,
    limit: maxTasks,
    tier,
    upgradeRequired: current >= maxTasks,
  };
}

/**
 * Get maximum repositories allowed for a subscription tier.
 */
export function getMaxReposForTier(tier: SubscriptionTier): number {
  const plan = getPlanConfig(tier);
  return plan.maxRepos;
}

/**
 * Get maximum tasks allowed per repository for a subscription tier.
 */
export function getMaxTasksForTier(tier: SubscriptionTier): number {
  const plan = getPlanConfig(tier);
  return plan.maxTasksPerRepo;
}

/**
 * Format limit error message for API response.
 */
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
  const resourceSingular = resourceType;

  return {
    error: `${resourceSingular}_limit_reached`,
    message: `You've reached the limit of ${limitCheck.limit} ${resourcePlural} for the ${limitCheck.tier} plan. Upgrade to create more.`,
    current: limitCheck.current,
    limit: limitCheck.limit,
    tier: limitCheck.tier,
    upgradeUrl: "/billing",
  };
}
