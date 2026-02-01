/**
 * Stripe Integration
 * Phase 3.1: SaaS & Billing Integration
 */

import Stripe from "stripe";

// Initialize Stripe client (use dummy key in test environment)
const stripeKey =
  process.env.STRIPE_SECRET_KEY ||
  (process.env.NODE_ENV === "test" ? "sk_test_dummy_key_for_tests" : "");

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

// Subscription plan definitions
export const STRIPE_PLANS = {
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

export type SubscriptionTier = keyof typeof STRIPE_PLANS;

/**
 * Get plan configuration by tier
 */
export function getPlanConfig(tier: SubscriptionTier) {
  return STRIPE_PLANS[tier];
}

/**
 * Check if a tier allows unlimited resources
 */
export function isUnlimited(
  tier: SubscriptionTier,
  resource: "repos" | "tasks",
) {
  const plan = STRIPE_PLANS[tier];
  if (resource === "repos") return plan.maxRepos === -1;
  return plan.maxTasksPerRepo === -1;
}

/**
 * Get limit for a tier and resource type
 */
export function getLimit(
  tier: SubscriptionTier,
  resource: "repos" | "tasks",
): number {
  const plan = STRIPE_PLANS[tier];
  if (resource === "repos") return plan.maxRepos;
  return plan.maxTasksPerRepo;
}
