import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

// Test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/loopforge_test";

// Unique prefix for this test file to avoid conflicts with parallel tests
const TEST_PREFIX = `billing-${Date.now()}`;

describe("Billing and Subscription Schema", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
    });
    db = drizzle(pool, { schema });

    // Create enums and tables for testing
    await pool.query(`
      -- Drop tables if they exist (for clean test runs)
      DROP TABLE IF EXISTS usage_records CASCADE;
      DROP TABLE IF EXISTS user_subscriptions CASCADE;
      DROP TABLE IF EXISTS subscription_plans CASCADE;
      DROP TABLE IF EXISTS execution_events CASCADE;
      DROP TABLE IF EXISTS executions CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS repos CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      -- Drop enums if they exist
      DROP TYPE IF EXISTS task_status CASCADE;
      DROP TYPE IF EXISTS execution_status CASCADE;
      DROP TYPE IF EXISTS execution_event_type CASCADE;
      DROP TYPE IF EXISTS billing_cycle CASCADE;
      DROP TYPE IF EXISTS subscription_status CASCADE;
      DROP TYPE IF EXISTS billing_mode CASCADE;
      DROP TYPE IF EXISTS ai_provider CASCADE;

      -- Create enums
      CREATE TYPE task_status AS ENUM ('todo', 'brainstorming', 'planning', 'ready', 'executing', 'done', 'stuck');
      CREATE TYPE execution_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
      CREATE TYPE execution_event_type AS ENUM ('thinking', 'file_read', 'file_write', 'command_run', 'commit', 'error', 'complete', 'stuck');
      CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
      CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
      CREATE TYPE billing_mode AS ENUM ('byok', 'managed');
      CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai', 'gemini');

      -- Create tables
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        github_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        email TEXT,
        avatar_url TEXT,
        encrypted_api_key TEXT,
        api_key_iv TEXT,
        openai_encrypted_api_key TEXT,
        openai_api_key_iv TEXT,
        gemini_encrypted_api_key TEXT,
        gemini_api_key_iv TEXT,
        encrypted_github_token TEXT,
        github_token_iv TEXT,
        billing_mode billing_mode,
        stripe_customer_id TEXT,
        preferred_anthropic_model TEXT DEFAULT 'claude-sonnet-4-20250514',
        preferred_openai_model TEXT DEFAULT 'gpt-4o',
        preferred_gemini_model TEXT DEFAULT 'gemini-2.5-pro',
        preferred_provider ai_provider DEFAULT 'anthropic',
        onboarding_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE repos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        github_repo_id TEXT NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        default_branch TEXT NOT NULL DEFAULT 'main',
        clone_url TEXT NOT NULL,
        is_private BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status task_status NOT NULL DEFAULT 'todo',
        priority INTEGER NOT NULL DEFAULT 0,
        brainstorm_result TEXT,
        plan_content TEXT,
        branch TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        status execution_status NOT NULL DEFAULT 'queued',
        iteration INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        logs_path TEXT,
        commits JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE execution_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
        event_type execution_event_type NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        price_monthly INTEGER NOT NULL,
        price_yearly INTEGER NOT NULL,
        stripe_price_monthly TEXT,
        stripe_price_yearly TEXT,
        task_limit INTEGER NOT NULL,
        grace_percent INTEGER NOT NULL DEFAULT 10,
        features JSONB,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE user_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID NOT NULL REFERENCES subscription_plans(id),
        stripe_subscription_id TEXT,
        stripe_customer_id TEXT,
        billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        status subscription_status NOT NULL DEFAULT 'active',
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE usage_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        period_start TIMESTAMP NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_cents INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean tables before each test
    await pool.query(`
      TRUNCATE usage_records, user_subscriptions, subscription_plans,
               execution_events, executions, tasks, repos, users CASCADE;
    `);
  });

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
