/**
 * Subscription Adapter Tests
 *
 * Verifies mapping between Subscription domain models and API formats.
 */

import { describe, it, expect } from "vitest";
import {
  SubscriptionAdapter,
  type SubscriptionApiResponse,
  type SubscriptionWithUsageApiResponse,
  type UpdateSubscriptionRequest,
} from "@/lib/contexts/billing/api/adapters";
import type { SubscriptionState } from "@/lib/contexts/billing/domain/subscription-aggregate";
import type { UsageSummary } from "@/lib/contexts/billing/domain/types";

describe("SubscriptionAdapter", () => {
  describe("toApiResponse", () => {
    it("should map all fields correctly with full data", () => {
      const now = new Date();
      const state: SubscriptionState = {
        id: "sub-1",
        userId: "user-1",
        planTier: "pro",
        billingMode: "managed",
        status: "active",
        limits: {
          maxRepos: 20,
          maxTasks: 100,
          maxTokensPerMonth: 5000000,
        },
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        periodEnd: now,
        createdAt: now,
        updatedAt: now,
      };

      const response = SubscriptionAdapter.toApiResponse(state);

      // Identity
      expect(response.id).toBe("sub-1");
      expect(response.userId).toBe("user-1");

      // Plan information
      expect(response.planTier).toBe("pro");
      expect(response.billingMode).toBe("managed");
      expect(response.status).toBe("active");

      // Limits (flattened)
      expect(response.maxRepos).toBe(20);
      expect(response.maxTasks).toBe(100);
      expect(response.maxTokensPerMonth).toBe(5000000);

      // Stripe
      expect(response.stripeCustomerId).toBe("cus_123");
      expect(response.stripeSubscriptionId).toBe("sub_123");
      expect(response.periodEnd).toBe(now);

      // Timestamps
      expect(response.createdAt).toBe(now);
      expect(response.updatedAt).toBe(now);
    });

    it("should handle free tier", () => {
      const state: SubscriptionState = {
        id: "sub-2",
        userId: "user-2",
        planTier: "free",
        billingMode: "byok",
        status: "active",
        limits: {
          maxRepos: 1,
          maxTasks: 5,
          maxTokensPerMonth: 100000,
        },
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        periodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = SubscriptionAdapter.toApiResponse(state);

      expect(response.planTier).toBe("free");
      expect(response.billingMode).toBe("byok");
      expect(response.maxRepos).toBe(1);
      expect(response.maxTasks).toBe(5);
      expect(response.maxTokensPerMonth).toBe(100000);
      expect(response.stripeCustomerId).toBeNull();
      expect(response.stripeSubscriptionId).toBeNull();
      expect(response.periodEnd).toBeNull();
    });

    it("should handle enterprise tier with unlimited limits", () => {
      const state: SubscriptionState = {
        id: "sub-3",
        userId: "user-3",
        planTier: "enterprise",
        billingMode: "managed",
        status: "active",
        limits: {
          maxRepos: -1, // Unlimited
          maxTasks: -1, // Unlimited
          maxTokensPerMonth: -1, // Unlimited
        },
        stripeCustomerId: "cus_ent",
        stripeSubscriptionId: "sub_ent",
        periodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = SubscriptionAdapter.toApiResponse(state);

      expect(response.planTier).toBe("enterprise");
      expect(response.maxRepos).toBe(-1);
      expect(response.maxTasks).toBe(-1);
      expect(response.maxTokensPerMonth).toBe(-1);
    });

    it("should handle canceled subscription", () => {
      const state: SubscriptionState = {
        id: "sub-4",
        userId: "user-4",
        planTier: "pro",
        billingMode: "managed",
        status: "canceled",
        limits: {
          maxRepos: 20,
          maxTasks: 100,
          maxTokensPerMonth: 5000000,
        },
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        periodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = SubscriptionAdapter.toApiResponse(state);

      expect(response.status).toBe("canceled");
    });

    it("should handle past_due subscription", () => {
      const state: SubscriptionState = {
        id: "sub-5",
        userId: "user-5",
        planTier: "pro",
        billingMode: "managed",
        status: "past_due",
        limits: {
          maxRepos: 20,
          maxTasks: 100,
          maxTokensPerMonth: 5000000,
        },
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        periodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = SubscriptionAdapter.toApiResponse(state);

      expect(response.status).toBe("past_due");
    });
  });

  describe("toApiResponseWithUsage", () => {
    it("should include usage data and limit checks", () => {
      const state: SubscriptionState = {
        id: "sub-1",
        userId: "user-1",
        planTier: "pro",
        billingMode: "managed",
        status: "active",
        limits: {
          maxRepos: 20,
          maxTasks: 100,
          maxTokensPerMonth: 5000000,
        },
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        periodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const usage: UsageSummary = {
        totalTokens: 2500000,
        totalExecutions: 50,
        byProvider: {
          anthropic: 1500000,
          openai: 1000000,
        },
        byModel: {
          "claude-sonnet-4": 1500000,
          "gpt-4o": 1000000,
        },
      };

      const currentCounts = {
        repos: 10,
        tasks: 45,
      };

      const response = SubscriptionAdapter.toApiResponseWithUsage(
        state,
        usage,
        currentCounts,
      );

      // Basic fields
      expect(response.id).toBe("sub-1");
      expect(response.planTier).toBe("pro");

      // Usage summary
      expect(response.usage).toBe(usage);
      expect(response.usage.totalTokens).toBe(2500000);
      expect(response.usage.totalExecutions).toBe(50);

      // Current usage
      expect(response.reposUsed).toBe(10);
      expect(response.tasksUsed).toBe(45);
      expect(response.tokensUsed).toBe(2500000);

      // Limit checks (none reached)
      expect(response.reposLimitReached).toBe(false);
      expect(response.tasksLimitReached).toBe(false);
      expect(response.tokensLimitReached).toBe(false);
    });

    it("should detect repos limit reached", () => {
      const state: SubscriptionState = {
        id: "sub-2",
        userId: "user-2",
        planTier: "free",
        billingMode: "byok",
        status: "active",
        limits: {
          maxRepos: 1,
          maxTasks: 5,
          maxTokensPerMonth: 100000,
        },
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        periodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const usage: UsageSummary = {
        totalTokens: 50000,
        totalExecutions: 10,
        byProvider: {},
        byModel: {},
      };

      const currentCounts = {
        repos: 1, // At limit
        tasks: 3,
      };

      const response = SubscriptionAdapter.toApiResponseWithUsage(
        state,
        usage,
        currentCounts,
      );

      expect(response.reposLimitReached).toBe(true);
      expect(response.tasksLimitReached).toBe(false);
      expect(response.tokensLimitReached).toBe(false);
    });

    it("should detect tasks limit reached", () => {
      const state: SubscriptionState = {
        id: "sub-3",
        userId: "user-3",
        planTier: "free",
        billingMode: "byok",
        status: "active",
        limits: {
          maxRepos: 1,
          maxTasks: 5,
          maxTokensPerMonth: 100000,
        },
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        periodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const usage: UsageSummary = {
        totalTokens: 50000,
        totalExecutions: 10,
        byProvider: {},
        byModel: {},
      };

      const currentCounts = {
        repos: 1,
        tasks: 5, // At limit
      };

      const response = SubscriptionAdapter.toApiResponseWithUsage(
        state,
        usage,
        currentCounts,
      );

      expect(response.reposLimitReached).toBe(true);
      expect(response.tasksLimitReached).toBe(true);
      expect(response.tokensLimitReached).toBe(false);
    });

    it("should detect tokens limit reached", () => {
      const state: SubscriptionState = {
        id: "sub-4",
        userId: "user-4",
        planTier: "free",
        billingMode: "byok",
        status: "active",
        limits: {
          maxRepos: 1,
          maxTasks: 5,
          maxTokensPerMonth: 100000,
        },
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        periodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const usage: UsageSummary = {
        totalTokens: 100000, // At limit
        totalExecutions: 10,
        byProvider: {},
        byModel: {},
      };

      const currentCounts = {
        repos: 1,
        tasks: 3,
      };

      const response = SubscriptionAdapter.toApiResponseWithUsage(
        state,
        usage,
        currentCounts,
      );

      expect(response.reposLimitReached).toBe(true);
      expect(response.tasksLimitReached).toBe(false);
      expect(response.tokensLimitReached).toBe(true);
    });

    it("should handle unlimited limits correctly", () => {
      const state: SubscriptionState = {
        id: "sub-5",
        userId: "user-5",
        planTier: "enterprise",
        billingMode: "managed",
        status: "active",
        limits: {
          maxRepos: -1, // Unlimited
          maxTasks: -1, // Unlimited
          maxTokensPerMonth: -1, // Unlimited
        },
        stripeCustomerId: "cus_ent",
        stripeSubscriptionId: "sub_ent",
        periodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const usage: UsageSummary = {
        totalTokens: 10000000, // High usage
        totalExecutions: 1000,
        byProvider: {},
        byModel: {},
      };

      const currentCounts = {
        repos: 100,
        tasks: 500,
      };

      const response = SubscriptionAdapter.toApiResponseWithUsage(
        state,
        usage,
        currentCounts,
      );

      // All should be false (unlimited)
      expect(response.reposLimitReached).toBe(false);
      expect(response.tasksLimitReached).toBe(false);
      expect(response.tokensLimitReached).toBe(false);
    });
  });

  describe("fromUpdateRequest", () => {
    it("should extract plan tier only", () => {
      const request: UpdateSubscriptionRequest = {
        planTier: "pro",
      };

      const result = SubscriptionAdapter.fromUpdateRequest(request);

      expect(result.planTier).toBe("pro");
      expect(result.billingMode).toBeUndefined();
      expect(result.stripeCustomerId).toBeUndefined();
    });

    it("should extract billing mode only", () => {
      const request: UpdateSubscriptionRequest = {
        billingMode: "managed",
      };

      const result = SubscriptionAdapter.fromUpdateRequest(request);

      expect(result.planTier).toBeUndefined();
      expect(result.billingMode).toBe("managed");
    });

    it("should extract Stripe IDs only", () => {
      const request: UpdateSubscriptionRequest = {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
      };

      const result = SubscriptionAdapter.fromUpdateRequest(request);

      expect(result.stripeCustomerId).toBe("cus_123");
      expect(result.stripeSubscriptionId).toBe("sub_123");
    });

    it("should extract all fields", () => {
      const request: UpdateSubscriptionRequest = {
        planTier: "enterprise",
        billingMode: "managed",
        stripeCustomerId: "cus_ent",
        stripeSubscriptionId: "sub_ent",
      };

      const result = SubscriptionAdapter.fromUpdateRequest(request);

      expect(result.planTier).toBe("enterprise");
      expect(result.billingMode).toBe("managed");
      expect(result.stripeCustomerId).toBe("cus_ent");
      expect(result.stripeSubscriptionId).toBe("sub_ent");
    });

    it("should handle empty request", () => {
      const request: UpdateSubscriptionRequest = {};

      const result = SubscriptionAdapter.fromUpdateRequest(request);

      expect(result).toEqual({});
    });
  });

  describe("fromDatabaseRow", () => {
    it("should map all fields from database row", () => {
      const now = new Date();
      const row = {
        id: "sub-1",
        userId: "user-1",
        planTier: "pro" as const,
        billingMode: "managed" as const,
        status: "active" as const,
        maxRepos: 20,
        maxTasks: 100,
        maxTokensPerMonth: 5000000,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        periodEnd: now,
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromDatabaseRow(row);

      expect(state.id).toBe("sub-1");
      expect(state.userId).toBe("user-1");
      expect(state.planTier).toBe("pro");
      expect(state.billingMode).toBe("managed");
      expect(state.status).toBe("active");
      expect(state.limits.maxRepos).toBe(20);
      expect(state.limits.maxTasks).toBe(100);
      expect(state.limits.maxTokensPerMonth).toBe(5000000);
      expect(state.stripeCustomerId).toBe("cus_123");
      expect(state.stripeSubscriptionId).toBe("sub_123");
      expect(state.periodEnd).toBe(now);
      expect(state.createdAt).toBe(now);
      expect(state.updatedAt).toBe(now);
    });

    it("should use defaults for missing optional fields", () => {
      const now = new Date();
      const row = {
        id: "sub-2",
        userId: "user-2",
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromDatabaseRow(row);

      expect(state.planTier).toBe("free"); // Default
      expect(state.billingMode).toBe("byok"); // Default
      expect(state.status).toBe("active"); // Default
      expect(state.limits.maxRepos).toBe(1); // Default (free tier)
      expect(state.limits.maxTasks).toBe(5);
      expect(state.limits.maxTokensPerMonth).toBe(100000);
      expect(state.stripeCustomerId).toBeNull();
      expect(state.stripeSubscriptionId).toBeNull();
      expect(state.periodEnd).toBeNull();
    });
  });

  describe("fromUserTableRow", () => {
    it("should map from users table row (free tier)", () => {
      const now = new Date();
      const row = {
        id: "user-1",
        billingMode: "byok",
        subscriptionTier: "free",
        subscriptionStatus: "active",
        subscriptionPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromUserTableRow(row);

      expect(state.id).toBe("sub-user-1");
      expect(state.userId).toBe("user-1");
      expect(state.planTier).toBe("free");
      expect(state.billingMode).toBe("byok");
      expect(state.status).toBe("active");
      expect(state.limits.maxRepos).toBe(1);
      expect(state.limits.maxTasks).toBe(5);
      expect(state.limits.maxTokensPerMonth).toBe(100000);
    });

    it("should map from users table row (pro tier)", () => {
      const now = new Date();
      const row = {
        id: "user-2",
        billingMode: "managed",
        subscriptionTier: "pro",
        subscriptionStatus: "active",
        subscriptionPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromUserTableRow(row);

      expect(state.planTier).toBe("pro");
      expect(state.billingMode).toBe("managed");
      expect(state.limits.maxRepos).toBe(20);
      expect(state.limits.maxTasks).toBe(100);
      expect(state.limits.maxTokensPerMonth).toBe(5000000);
      expect(state.periodEnd).toBe(now);
    });

    it("should map from users table row (enterprise tier)", () => {
      const now = new Date();
      const row = {
        id: "user-3",
        billingMode: "managed",
        subscriptionTier: "enterprise",
        subscriptionStatus: "active",
        subscriptionPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromUserTableRow(row);

      expect(state.planTier).toBe("enterprise");
      expect(state.limits.maxRepos).toBe(-1); // Unlimited
      expect(state.limits.maxTasks).toBe(-1);
      expect(state.limits.maxTokensPerMonth).toBe(-1);
    });

    it("should handle canceled status", () => {
      const now = new Date();
      const row = {
        id: "user-4",
        billingMode: "managed",
        subscriptionTier: "pro",
        subscriptionStatus: "canceled",
        subscriptionPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromUserTableRow(row);

      expect(state.status).toBe("canceled");
    });

    it("should handle null values", () => {
      const now = new Date();
      const row = {
        id: "user-5",
        billingMode: null,
        subscriptionTier: null,
        subscriptionStatus: null,
        subscriptionPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
      };

      const state = SubscriptionAdapter.fromUserTableRow(row);

      expect(state.planTier).toBe("free"); // Default
      expect(state.billingMode).toBe("byok"); // Default
      expect(state.status).toBe("active"); // Default
      expect(state.periodEnd).toBeNull();
    });
  });

  describe("Round-trip conversion", () => {
    it("should preserve data through database -> domain -> API conversion", () => {
      const now = new Date();
      const dbRow = {
        id: "sub-1",
        userId: "user-1",
        planTier: "pro" as const,
        billingMode: "managed" as const,
        status: "active" as const,
        maxRepos: 20,
        maxTasks: 100,
        maxTokensPerMonth: 5000000,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        periodEnd: now,
        createdAt: now,
        updatedAt: now,
      };

      // DB -> Domain
      const state = SubscriptionAdapter.fromDatabaseRow(dbRow);

      // Domain -> API
      const apiResponse = SubscriptionAdapter.toApiResponse(state);

      // Verify key fields preserved
      expect(apiResponse.id).toBe(dbRow.id);
      expect(apiResponse.userId).toBe(dbRow.userId);
      expect(apiResponse.planTier).toBe(dbRow.planTier);
      expect(apiResponse.billingMode).toBe(dbRow.billingMode);
      expect(apiResponse.status).toBe(dbRow.status);
      expect(apiResponse.maxRepos).toBe(dbRow.maxRepos);
      expect(apiResponse.maxTasks).toBe(dbRow.maxTasks);
      expect(apiResponse.maxTokensPerMonth).toBe(dbRow.maxTokensPerMonth);
      expect(apiResponse.stripeCustomerId).toBe(dbRow.stripeCustomerId);
      expect(apiResponse.periodEnd).toBe(dbRow.periodEnd);
    });
  });
});
