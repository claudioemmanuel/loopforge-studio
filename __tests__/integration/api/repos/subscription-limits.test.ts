/**
 * Integration Tests: Subscription Limit Enforcement
 * Tests for race condition fixes and database constraint enforcement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db, users, repos } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getBillingService,
  getMaxReposForTier,
} from "@/lib/contexts/billing/api";

// Mock Stripe to avoid requiring API key in tests
vi.mock("@/lib/contexts/billing/infrastructure/stripe", async () => {
  const actual = await vi.importActual(
    "@/lib/contexts/billing/infrastructure/stripe",
  );
  return {
    ...actual,
    stripe: {
      webhooks: { constructEvent: vi.fn() },
      subscriptions: { cancel: vi.fn(), retrieve: vi.fn() },
    },
  };
});

describe("Subscription Limit Enforcement", () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user with free tier
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        githubId: `gh-${crypto.randomUUID()}`,
        username: "testuser",
        email: "test@example.com",
        subscriptionTier: "free",
      })
      .returning();

    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(repos).where(eq(repos.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe("Database Constraint Enforcement", () => {
    it("should allow adding repo when under limit", async () => {
      const result = await db
        .insert(repos)
        .values({
          id: crypto.randomUUID(),
          userId: testUserId,
          githubRepoId: "12345",
          name: "test-repo",
          fullName: "user/test-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/user/test-repo.git",
          isPrivate: false,
        })
        .returning();

      expect(result).toHaveLength(1);
    });

    it("should block adding second repo on free tier", async () => {
      // Add first repo
      await db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: "12345",
        name: "test-repo-1",
        fullName: "user/test-repo-1",
        defaultBranch: "main",
        cloneUrl: "https://github.com/user/test-repo-1.git",
        isPrivate: false,
      });

      // Attempt to add second repo - should be blocked by trigger
      await expect(
        db.insert(repos).values({
          id: crypto.randomUUID(),
          userId: testUserId,
          githubRepoId: "67890",
          name: "test-repo-2",
          fullName: "user/test-repo-2",
          defaultBranch: "main",
          cloneUrl: "https://github.com/user/test-repo-2.git",
          isPrivate: false,
        }),
      ).rejects.toThrow(/Repository limit exceeded/);
    });

    it("should allow pro tier to add up to 20 repos", async () => {
      // Update user to pro tier
      await db
        .update(users)
        .set({ subscriptionTier: "pro" })
        .where(eq(users.id, testUserId));

      // Add 20 repos
      for (let i = 0; i < 20; i++) {
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

      // Verify 20 repos added
      const repoCount = await db
        .select()
        .from(repos)
        .where(eq(repos.userId, testUserId));

      expect(repoCount).toHaveLength(20);

      // 21st repo should fail
      await expect(
        db.insert(repos).values({
          id: crypto.randomUUID(),
          userId: testUserId,
          githubRepoId: "30000",
          name: "test-repo-21",
          fullName: "user/test-repo-21",
          defaultBranch: "main",
          cloneUrl: "https://github.com/user/test-repo-21.git",
          isPrivate: false,
        }),
      ).rejects.toThrow(/Repository limit exceeded/);
    });

    it("should allow enterprise tier unlimited repos", async () => {
      // Update user to enterprise tier
      await db
        .update(users)
        .set({ subscriptionTier: "enterprise" })
        .where(eq(users.id, testUserId));

      // Add 25 repos (more than pro limit)
      for (let i = 0; i < 25; i++) {
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

      // Verify all 25 repos added
      const repoCount = await db
        .select()
        .from(repos)
        .where(eq(repos.userId, testUserId));

      expect(repoCount).toHaveLength(25);
    });
  });

  describe("Race Condition Prevention", () => {
    it("should prevent concurrent repo additions from bypassing limit", async () => {
      // Simulate two concurrent requests trying to add repos
      const addRepo1 = db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: "11111",
        name: "concurrent-repo-1",
        fullName: "user/concurrent-repo-1",
        defaultBranch: "main",
        cloneUrl: "https://github.com/user/concurrent-repo-1.git",
        isPrivate: false,
      });

      const addRepo2 = db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: "22222",
        name: "concurrent-repo-2",
        fullName: "user/concurrent-repo-2",
        defaultBranch: "main",
        cloneUrl: "https://github.com/user/concurrent-repo-2.git",
        isPrivate: false,
      });

      // Run both concurrently
      const results = await Promise.allSettled([addRepo1, addRepo2]);

      // Exactly one should succeed, one should fail
      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify only one repo was added
      const repoCount = await db
        .select()
        .from(repos)
        .where(eq(repos.userId, testUserId));

      expect(repoCount).toHaveLength(1);
    });
  });

  describe("Limit Check Functions", () => {
    it("should correctly report repo limits for free tier", async () => {
      const limitCheck = await getBillingService().checkLimits(testUserId);

      expect(limitCheck.usage.limits.maxRepos).toBe(1);
      expect(limitCheck.usage.repos).toBe(0);
      expect(limitCheck.withinLimits).toBe(true);
    });

    it("should correctly report when at limit", async () => {
      // Add one repo
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

      const limitCheck = await getBillingService().checkLimits(testUserId);

      expect(limitCheck.usage.repos).toBe(1);
      expect(limitCheck.usage.limits.maxRepos).toBe(1);
      // At exactly the cap, service still considers limits satisfied
      expect(limitCheck.withinLimits).toBe(true);
    });

    it("should return correct limits for each tier", () => {
      expect(getMaxReposForTier("free")).toBe(1);
      expect(getMaxReposForTier("pro")).toBe(20);
      expect(getMaxReposForTier("enterprise")).toBe(-1); // unlimited
    });
  });

  describe("Tier Transitions", () => {
    it("should allow repos after upgrading from free to pro", async () => {
      // Add one repo on free tier
      await db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: "12345",
        name: "test-repo-1",
        fullName: "user/test-repo-1",
        defaultBranch: "main",
        cloneUrl: "https://github.com/user/test-repo-1.git",
        isPrivate: false,
      });

      // Upgrade to pro
      await db
        .update(users)
        .set({ subscriptionTier: "pro" })
        .where(eq(users.id, testUserId));

      // Add second repo - should succeed
      await db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: "67890",
        name: "test-repo-2",
        fullName: "user/test-repo-2",
        defaultBranch: "main",
        cloneUrl: "https://github.com/user/test-repo-2.git",
        isPrivate: false,
      });

      const repoCount = await db
        .select()
        .from(repos)
        .where(eq(repos.userId, testUserId));

      expect(repoCount).toHaveLength(2);
    });
  });
});
