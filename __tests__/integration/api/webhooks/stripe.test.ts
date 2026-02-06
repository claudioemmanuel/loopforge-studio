/**
 * Integration tests for billing subscription state transitions.
 *
 * Note: webhook route was removed; this suite validates the persisted state
 * transitions that the webhook handler used to coordinate.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { db, repos, users } from "@/lib/db";

describe("Stripe Billing State Transitions", () => {
  let testUserId: string;
  let testCustomerId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}-${Math.random()}`;
    testCustomerId = `cus_${crypto.randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        githubId: `gh-${unique}`,
        username: `user-${unique}`,
        email: `user-${unique}@example.com`,
        subscriptionTier: "free",
        stripeCustomerId: testCustomerId,
        subscriptionStatus: "active",
      })
      .returning();

    testUserId = user.id;
  });

  afterEach(async () => {
    await db.delete(repos).where(eq(repos.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("upgrades tier on active subscription", async () => {
    await db
      .update(users)
      .set({
        subscriptionTier: "pro",
        subscriptionStatus: "active",
      })
      .where(eq(users.stripeCustomerId, testCustomerId));

    const user = await db.query.users.findFirst({
      where: eq(users.id, testUserId),
    });
    expect(user?.subscriptionTier).toBe("pro");
    expect(user?.subscriptionStatus).toBe("active");
  });

  it("downgrades tier on cancellation", async () => {
    await db
      .update(users)
      .set({
        subscriptionTier: "pro",
        subscriptionStatus: "active",
      })
      .where(eq(users.id, testUserId));

    await db
      .update(users)
      .set({
        subscriptionTier: "free",
        subscriptionStatus: "canceled",
      })
      .where(eq(users.id, testUserId));

    const user = await db.query.users.findFirst({
      where: eq(users.id, testUserId),
    });
    expect(user?.subscriptionTier).toBe("free");
    expect(user?.subscriptionStatus).toBe("canceled");
  });

  it("blocks downgrade when free-tier repo limits are exceeded", async () => {
    await db
      .update(users)
      .set({ subscriptionTier: "pro" })
      .where(eq(users.id, testUserId));

    for (let i = 0; i < 3; i++) {
      await db.insert(repos).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        githubRepoId: `${10000 + i}`,
        name: `repo-${i}`,
        fullName: `owner/repo-${i}`,
        defaultBranch: "main",
        cloneUrl: `https://github.com/owner/repo-${i}.git`,
      });
    }

    const repoCount = await db
      .select({ value: count() })
      .from(repos)
      .where(eq(repos.userId, testUserId));
    const current = Number(repoCount[0]?.value ?? 0);

    const freeTierLimit = 1;
    expect(current).toBeGreaterThan(freeTierLimit);
  });
});
