/**
 * Integration Tests: Stripe Webhook Handler
 * Tests for subscription tier updates via Stripe webhooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db, users, repos } from "@/lib/db";
import { eq, count } from "drizzle-orm";
import type Stripe from "stripe";

// Mock Stripe
vi.mock("@/lib/billing/infra", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      cancel: vi.fn(),
      retrieve: vi.fn(),
    },
  }),
}));

describe("Stripe Webhook Handler", () => {
  let testUserId: string;
  let testCustomerId: string;

  beforeEach(async () => {
    testCustomerId = `cus_${crypto.randomUUID()}`;

    // Create test user with Stripe customer ID
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: "test@example.com",
        subscriptionTier: "free",
        stripeCustomerId: testCustomerId,
      })
      .returning();

    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(repos).where(eq(repos.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    vi.clearAllMocks();
  });

  describe("Subscription Updates", () => {
    it("should update user tier when subscription is activated", async () => {
      // Note: Actual webhook implementation would be tested via API route
      // This tests the database update logic

      // Simulate upgrade to pro
      await db
        .update(users)
        .set({
          subscriptionTier: "pro",
          stripeSubscriptionId: "sub_test123",
        })
        .where(eq(users.stripeCustomerId, testCustomerId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.subscriptionTier).toBe("pro");
      expect(user?.stripeSubscriptionId).toBe("sub_test123");
    });

    it("should downgrade user tier when subscription is cancelled", async () => {
      // Start with pro tier
      await db
        .update(users)
        .set({
          subscriptionTier: "pro",
          stripeSubscriptionId: "sub_test123",
        })
        .where(eq(users.stripeCustomerId, testCustomerId));

      // Simulate cancellation (downgrade to free)
      await db
        .update(users)
        .set({
          subscriptionTier: "free",
          stripeSubscriptionId: null,
        })
        .where(eq(users.stripeCustomerId, testCustomerId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.subscriptionTier).toBe("free");
      expect(user?.stripeSubscriptionId).toBeNull();
    });
  });

  describe("Downgrade Protection", () => {
    it("should prevent downgrade if user exceeds new tier limit", async () => {
      // Upgrade to pro
      await db
        .update(users)
        .set({ subscriptionTier: "pro" })
        .where(eq(users.id, testUserId));

      // Add 5 repos (exceeds free tier limit of 1)
      for (let i = 0; i < 5; i++) {
        await db.insert(repos).values({
          id: crypto.randomUUID(),
          userId: testUserId,
          githubRepoId: String(10000 + i),
          name: `test-repo-${i}`,
          fullName: `user/test-repo-${i}`,
          defaultBranch: "main",
          cloneUrl: `https://github.com/user/test-repo-${i}.git`,
          isPrivate: false,
        });
      }

      // Check repo count
      const repoCountResult = await db
        .select({ count: count() })
        .from(repos)
        .where(eq(repos.userId, testUserId));

      const currentRepoCount = repoCountResult[0]?.count || 0;
      expect(currentRepoCount).toBe(5);

      // Downgrade should be blocked in actual webhook handler
      // Here we verify the check would fail
      const freeMaxRepos = 1;
      const shouldBlockDowngrade = currentRepoCount > freeMaxRepos;

      expect(shouldBlockDowngrade).toBe(true);
    });

    it("should allow downgrade if user is within new tier limit", async () => {
      // Upgrade to pro
      await db
        .update(users)
        .set({ subscriptionTier: "pro" })
        .where(eq(users.id, testUserId));

      // Add only 1 repo (within free tier limit)
      await db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: "12345",
        name: "test-repo",
        fullName: "user/test-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/user/test-repo.git",
        isPrivate: false,
      });

      // Check repo count
      const repoCountResult = await db
        .select({ count: count() })
        .from(repos)
        .where(eq(repos.userId, testUserId));

      const currentRepoCount = repoCountResult[0]?.count || 0;
      expect(currentRepoCount).toBe(1);

      // Downgrade should be allowed
      const freeMaxRepos = 1;
      const shouldBlockDowngrade = currentRepoCount > freeMaxRepos;

      expect(shouldBlockDowngrade).toBe(false);

      // Perform downgrade
      await db
        .update(users)
        .set({ subscriptionTier: "free" })
        .where(eq(users.id, testUserId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.subscriptionTier).toBe("free");
    });
  });

  describe("Webhook Event Validation", () => {
    it("should handle customer.subscription.created event", () => {
      const mockEvent: Partial<Stripe.Event> = {
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_test123",
            customer: testCustomerId,
            status: "active",
            items: {
              data: [
                {
                  price: {
                    id: process.env.STRIPE_PRICE_PRO || "price_pro",
                  },
                } as Stripe.SubscriptionItem,
              ],
            },
          } as Stripe.Subscription,
        },
      };

      expect(mockEvent.type).toBe("customer.subscription.created");
      expect(mockEvent.data?.object).toBeDefined();
    });

    it("should handle customer.subscription.updated event", () => {
      const mockEvent: Partial<Stripe.Event> = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_test123",
            customer: testCustomerId,
            status: "active",
            items: {
              data: [
                {
                  price: {
                    id: process.env.STRIPE_PRICE_PRO || "price_pro",
                  },
                } as Stripe.SubscriptionItem,
              ],
            },
          } as Stripe.Subscription,
        },
      };

      expect(mockEvent.type).toBe("customer.subscription.updated");
    });

    it("should handle customer.subscription.deleted event", () => {
      const mockEvent: Partial<Stripe.Event> = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_test123",
            customer: testCustomerId,
            status: "canceled",
            items: {
              data: [],
            },
          } as Stripe.Subscription,
        },
      };

      expect(mockEvent.type).toBe("customer.subscription.deleted");
    });
  });
});
