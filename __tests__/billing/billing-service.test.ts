/**
 * Integration tests for Billing Context
 */

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Redis } from "ioredis";
import { BillingService } from "@/lib/contexts/billing/application/billing-service";
import { UsageService } from "@/lib/contexts/billing/application/usage-service";
import { randomUUID } from "crypto";

describe("Billing Context Integration Tests", () => {
  let redis: Redis;
  let billingService: BillingService;
  let usageService: UsageService;
  let testUserId: string;

  beforeEach(async () => {
    // Get Redis client
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    // Create services
    billingService = new BillingService(redis);
    usageService = new UsageService(redis);

    // Create test user
    testUserId = randomUUID();
    await db.insert(users).values({
      id: testUserId,
      githubId: 12345,
      username: "testuser",
      email: "test@example.com",
      avatarUrl: "https://example.com/avatar.jpg",
      githubAccessToken: "encrypted_token",
      planTier: "free",
      billingMode: "byok",
      subscriptionStatus: "active",
      maxRepos: 1,
      maxTasks: 5,
      maxTokensPerMonth: 100000,
    });
  });

  describe("Subscription Management", () => {
    it("should get user subscription", async () => {
      const subscription = await billingService.getSubscription(testUserId);

      expect(subscription).toBeDefined();
      expect(subscription?.userId).toBe(testUserId);
      expect(subscription?.planTier).toBe("free");
      expect(subscription?.billingMode).toBe("byok");
      expect(subscription?.status).toBe("active");
      expect(subscription?.isActive).toBe(true);
      expect(subscription?.isByok).toBe(true);
      expect(subscription?.limits).toEqual({
        maxRepos: 1,
        maxTasks: 5,
        maxTokensPerMonth: 100000,
      });
    });

    it("should upgrade subscription", async () => {
      await billingService.upgradeSubscription({
        userId: testUserId,
        newTier: "pro",
      });

      const subscription = await billingService.getSubscription(testUserId);

      expect(subscription?.planTier).toBe("pro");
      expect(subscription?.limits).toEqual({
        maxRepos: 20,
        maxTasks: 100,
        maxTokensPerMonth: 5000000,
      });
    });

    it("should downgrade subscription", async () => {
      // First upgrade to pro
      await billingService.upgradeSubscription({
        userId: testUserId,
        newTier: "pro",
      });

      // Then downgrade back to free
      await billingService.downgradeSubscription({
        userId: testUserId,
        newTier: "free",
      });

      const subscription = await billingService.getSubscription(testUserId);

      expect(subscription?.planTier).toBe("free");
      expect(subscription?.limits).toEqual({
        maxRepos: 1,
        maxTasks: 5,
        maxTokensPerMonth: 100000,
      });
    });

    it("should prevent invalid upgrade (downgrade with upgrade method)", async () => {
      await expect(
        billingService.upgradeSubscription({
          userId: testUserId,
          newTier: "free", // Already on free
        }),
      ).rejects.toThrow(/Cannot upgrade/);
    });

    it("should cancel subscription", async () => {
      await billingService.cancelSubscription({
        userId: testUserId,
        reason: "User requested cancellation",
      });

      const subscription = await billingService.getSubscription(testUserId);

      expect(subscription?.status).toBe("canceled");
      expect(subscription?.isActive).toBe(false);
    });
  });

  describe("Limit Checking", () => {
    it("should detect when limit exceeded", async () => {
      const exceeded = await billingService.checkLimit({
        userId: testUserId,
        limitType: "maxRepos",
        currentValue: 2, // Free plan allows only 1
      });

      expect(exceeded).toBe(true);
    });

    it("should allow when under limit", async () => {
      const exceeded = await billingService.checkLimit({
        userId: testUserId,
        limitType: "maxRepos",
        currentValue: 0, // Free plan allows 1, so 0 is under limit
      });

      expect(exceeded).toBe(false);
    });

    it("should handle unlimited limits", async () => {
      // Upgrade to enterprise (unlimited)
      await billingService.upgradeSubscription({
        userId: testUserId,
        newTier: "enterprise",
      });

      const exceeded = await billingService.checkLimit({
        userId: testUserId,
        limitType: "maxRepos",
        currentValue: 1000000, // Enterprise is unlimited
      });

      expect(exceeded).toBe(false);
    });
  });

  describe("Usage Tracking", () => {
    it("should record usage", async () => {
      const result = await usageService.recordUsage({
        userId: testUserId,
        executionId: "", // No execution for this test
        tokensUsed: 1000,
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      expect(result.usageId).toBeDefined();
    });

    it("should get usage summary", async () => {
      // Record multiple usage entries
      await usageService.recordUsage({
        userId: testUserId,
        executionId: "",
        tokensUsed: 1000,
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      await usageService.recordUsage({
        userId: testUserId,
        executionId: "",
        tokensUsed: 2000,
        provider: "openai",
        model: "gpt-4o",
      });

      const summary = await usageService.getUsageSummary({
        userId: testUserId,
      });

      expect(summary.totalTokens).toBe(3000);
      expect(summary.totalExecutions).toBe(2);
      expect(summary.byProvider).toEqual({
        anthropic: 1000,
        openai: 2000,
      });
      expect(summary.byModel).toEqual({
        "claude-sonnet-4": 1000,
        "gpt-4o": 2000,
      });
    });

    it("should get current monthly usage", async () => {
      await usageService.recordUsage({
        userId: testUserId,
        executionId: "",
        tokensUsed: 5000,
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      const monthlyUsage =
        await usageService.getCurrentMonthlyUsage(testUserId);

      expect(monthlyUsage).toBe(5000);
    });

    it("should prevent invalid token counts", async () => {
      await expect(
        usageService.recordUsage({
          userId: testUserId,
          executionId: "",
          tokensUsed: -100, // Negative tokens
          provider: "anthropic",
          model: "claude-sonnet-4",
        }),
      ).rejects.toThrow(/Invalid token count/);
    });

    it("should prevent invalid provider", async () => {
      await expect(
        usageService.recordUsage({
          userId: testUserId,
          executionId: "",
          tokensUsed: 1000,
          provider: "invalid-provider",
          model: "some-model",
        }),
      ).rejects.toThrow(/Invalid provider/);
    });
  });

  describe("Integration: Limits and Usage", () => {
    it("should detect when monthly token limit exceeded", async () => {
      // Record usage that exceeds free tier limit (100K tokens)
      await usageService.recordUsage({
        userId: testUserId,
        executionId: "",
        tokensUsed: 150000,
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      // Check if limit exceeded
      const monthlyUsage =
        await usageService.getCurrentMonthlyUsage(testUserId);

      const exceeded = await billingService.checkLimit({
        userId: testUserId,
        limitType: "maxTokensPerMonth",
        currentValue: monthlyUsage,
      });

      expect(exceeded).toBe(true);
    });

    it("should allow usage under limit", async () => {
      // Record usage under free tier limit
      await usageService.recordUsage({
        userId: testUserId,
        executionId: "",
        tokensUsed: 50000,
        provider: "anthropic",
        model: "claude-sonnet-4",
      });

      const monthlyUsage =
        await usageService.getCurrentMonthlyUsage(testUserId);

      const exceeded = await billingService.checkLimit({
        userId: testUserId,
        limitType: "maxTokensPerMonth",
        currentValue: monthlyUsage,
      });

      expect(exceeded).toBe(false);
    });
  });
});
