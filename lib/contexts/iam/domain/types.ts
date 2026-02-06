/**
 * IAM Domain Types
 *
 * Shared types for Identity and Access Management context.
 */

// AI provider values
export const aiProviders = ["anthropic", "openai", "gemini"] as const;
export type AiProvider = (typeof aiProviders)[number];

// Subscription tiers
export type SubscriptionTier = "free" | "pro" | "enterprise";

// Billing modes
export type BillingMode = "byok" | "managed";

// Subscription status
export type SubscriptionStatus = "active" | "canceled" | "past_due";

// Test gate policies
export type TestGatePolicy = "strict" | "warn" | "skip" | "autoApprove";
