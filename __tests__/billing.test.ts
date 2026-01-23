import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb } from "./setup/test-db";

// Unique prefix for this test file to avoid conflicts with parallel tests
const TEST_PREFIX = `billing-${Date.now()}`;

describe("Billing and Subscription Schema", () => {
  const db = getTestDb();

  describe("Billing Mode", () => {
    it("should create a user with BYOK billing mode", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-byok-user`,
        username: "byokuser",
        billingMode: "byok",
        encryptedApiKey: "encrypted_key",
        apiKeyIv: "iv_value",
      }).returning();

      expect(user).toBeDefined();
      expect(user.billingMode).toBe("byok");
      expect(user.encryptedApiKey).toBe("encrypted_key");
    });

    it("should create a user with managed billing mode", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-managed-user`,
        username: "manageduser",
        billingMode: "managed",
        stripeCustomerId: "cus_test123",
      }).returning();

      expect(user).toBeDefined();
      expect(user.billingMode).toBe("managed");
      expect(user.stripeCustomerId).toBe("cus_test123");
      expect(user.encryptedApiKey).toBeNull();
    });

    it("should allow null billing mode for new users", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-new-user`,
        username: "newuser",
      }).returning();

      expect(user).toBeDefined();
      expect(user.billingMode).toBeNull();
    });
  });

  describe("Subscription Plans with Stripe Price IDs", () => {
    it("should create a plan with Stripe price IDs", async () => {
      const planName = `${TEST_PREFIX}-pro`;
      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: planName,
        displayName: "Pro",
        priceMonthly: 3900,
        priceYearly: 39000,
        stripePriceMonthly: "price_pro_monthly",
        stripePriceYearly: "price_pro_yearly",
        taskLimit: 30,
        gracePercent: 10,
        features: ["30 tasks per month", "Priority support"],
      }).returning();

      expect(plan).toBeDefined();
      expect(plan.name).toBe(planName);
      expect(plan.stripePriceMonthly).toBe("price_pro_monthly");
      expect(plan.stripePriceYearly).toBe("price_pro_yearly");
    });

    it("should allow null Stripe price IDs", async () => {
      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-team`,
        displayName: "Team",
        priceMonthly: 12900,
        priceYearly: 129000,
        taskLimit: 100,
      }).returning();

      expect(plan).toBeDefined();
      expect(plan.stripePriceMonthly).toBeNull();
      expect(plan.stripePriceYearly).toBeNull();
    });
  });

  describe("User Subscriptions", () => {
    it("should create a subscription for a managed user", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-sub-user`,
        username: "subscriber",
        billingMode: "managed",
        stripeCustomerId: "cus_test123",
      }).returning();

      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-sub-pro`,
        displayName: "Pro",
        priceMonthly: 3900,
        priceYearly: 39000,
        stripePriceMonthly: "price_pro_monthly",
        taskLimit: 30,
      }).returning();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [subscription] = await db.insert(schema.userSubscriptions).values({
        userId: user.id,
        planId: plan.id,
        stripeSubscriptionId: "sub_test123",
        stripeCustomerId: "cus_test123",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: "active",
      }).returning();

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(user.id);
      expect(subscription.planId).toBe(plan.id);
      expect(subscription.stripeSubscriptionId).toBe("sub_test123");
      expect(subscription.status).toBe("active");
    });

    it("should support yearly billing cycle", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-yearly-user`,
        username: "yearlyuser",
        billingMode: "managed",
      }).returning();

      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-yearly-team`,
        displayName: "Team",
        priceMonthly: 12900,
        priceYearly: 129000,
        taskLimit: 100,
      }).returning();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const [subscription] = await db.insert(schema.userSubscriptions).values({
        userId: user.id,
        planId: plan.id,
        billingCycle: "yearly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: "active",
      }).returning();

      expect(subscription.billingCycle).toBe("yearly");
    });

    it("should track subscription status changes", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-status-user`,
        username: "testuser",
        billingMode: "managed",
      }).returning();

      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-status-pro`,
        displayName: "Pro",
        priceMonthly: 3900,
        priceYearly: 39000,
        taskLimit: 30,
      }).returning();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [subscription] = await db.insert(schema.userSubscriptions).values({
        userId: user.id,
        planId: plan.id,
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: "active",
      }).returning();

      // Update to past_due
      await db
        .update(schema.userSubscriptions)
        .set({ status: "past_due" })
        .where(eq(schema.userSubscriptions.id, subscription.id));

      const [updated] = await db
        .select()
        .from(schema.userSubscriptions)
        .where(eq(schema.userSubscriptions.id, subscription.id));

      expect(updated?.status).toBe("past_due");
    });

    it("should support cancel_at_period_end flag", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-cancel-user`,
        username: "canceluser",
        billingMode: "managed",
      }).returning();

      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-cancel-pro`,
        displayName: "Pro",
        priceMonthly: 3900,
        priceYearly: 39000,
        taskLimit: 30,
      }).returning();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [subscription] = await db.insert(schema.userSubscriptions).values({
        userId: user.id,
        planId: plan.id,
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: "active",
        cancelAtPeriodEnd: true,
      }).returning();

      expect(subscription.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe("Billing Mode Values", () => {
    it("should have correct billing mode values exported", () => {
      expect(schema.billingModes).toContain("byok");
      expect(schema.billingModes).toContain("managed");
      expect(schema.billingModes).toHaveLength(2);
    });
  });

  describe("Grace Period Calculation", () => {
    it("should calculate grace limit correctly", async () => {
      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-grace-pro`,
        displayName: "Pro",
        priceMonthly: 3900,
        priceYearly: 39000,
        taskLimit: 30,
        gracePercent: 10,
      }).returning();

      const graceLimit = Math.floor(plan.taskLimit * (1 + plan.gracePercent / 100));
      expect(graceLimit).toBe(33); // 30 + 10% = 33
    });

    it("should support custom grace percentages", async () => {
      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-grace-enterprise`,
        displayName: "Enterprise",
        priceMonthly: 49900,
        priceYearly: 499000,
        taskLimit: 500,
        gracePercent: 20,
      }).returning();

      const graceLimit = Math.floor(plan.taskLimit * (1 + plan.gracePercent / 100));
      expect(graceLimit).toBe(600); // 500 + 20% = 600
    });
  });
});
