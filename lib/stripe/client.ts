/**
 * Stripe Integration
 * Phase 3.1: SaaS & Billing Integration
 */

import Stripe from "stripe";

// Initialize Stripe client (use dummy key in test environment)
const stripeKey =
  process.env.STRIPE_SECRET_KEY ||
  (process.env.NODE_ENV === "test" ? "sk_test_dummy_key_for_tests" : "");

// Lazy-initialize Stripe client to avoid errors when STRIPE_SECRET_KEY is not set
let _stripe: Stripe | null = null;

/**
 * Get Stripe client instance (lazy-initialized)
 * Returns null if Stripe is not configured (missing STRIPE_SECRET_KEY)
 */
export function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;

  // Don't initialize if no API key is configured (except in test mode)
  if (!stripeKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️  STRIPE_SECRET_KEY not configured. Billing features will be unavailable.",
      );
    }
    return null;
  }

  _stripe = new Stripe(stripeKey, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
  });

  return _stripe;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getStripeClient() instead to handle missing configuration
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    if (!client) {
      throw new Error(
        "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.",
      );
    }
    return client[prop as keyof Stripe];
  },
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
