import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

// Test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/loopforge_test";

// Unique prefix for this test file to avoid conflicts with parallel tests
const TEST_PREFIX = `schema-${Date.now()}`;

describe("Database Schema", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Create test database pool
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
        brainstorm_conversation TEXT,
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

  describe("Users", () => {
    it("should create a user", async () => {
      const githubId = `${TEST_PREFIX}-user-create`;
      const [user] = await db.insert(schema.users).values({
        githubId,
        username: "testuser",
        email: "test@example.com",
      }).returning();

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe("testuser");
      expect(user.githubId).toBe(githubId);
    });

    it("should enforce unique github_id", async () => {
      const duplicateGithubId = `${TEST_PREFIX}-duplicate-${Math.random().toString(36).slice(2)}`;

      // First insert should succeed
      await db.insert(schema.users).values({
        githubId: duplicateGithubId,
        username: "user1",
      });

      // Second insert with same github_id should fail
      await expect(
        db.insert(schema.users).values({
          githubId: duplicateGithubId, // Same github_id - should fail
          username: "user2",
        })
      ).rejects.toThrow();
    });
  });

  describe("Repos", () => {
    it("should create a repo linked to a user", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-repo-user`,
        username: "testuser",
      }).returning();

      const [repo] = await db.insert(schema.repos).values({
        userId: user.id,
        githubRepoId: "repo-12345",
        name: "my-repo",
        fullName: "testuser/my-repo",
        cloneUrl: "https://github.com/testuser/my-repo.git",
      }).returning();

      expect(repo).toBeDefined();
      expect(repo.name).toBe("my-repo");
      expect(repo.userId).toBe(user.id);
    });
  });

  describe("Tasks", () => {
    it("should create a task with default status", async () => {
      // Setup user and repo first
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-task-user`,
        username: "testuser",
      }).returning();

      const [repo] = await db.insert(schema.repos).values({
        userId: user.id,
        githubRepoId: "repo-12345",
        name: "my-repo",
        fullName: "testuser/my-repo",
        cloneUrl: "https://github.com/testuser/my-repo.git",
      }).returning();

      const [task] = await db.insert(schema.tasks).values({
        repoId: repo.id,
        title: "Add user authentication",
        description: "Implement OAuth2 login",
      }).returning();

      expect(task).toBeDefined();
      expect(task.title).toBe("Add user authentication");
      expect(task.status).toBe("todo");
    });

    it("should update task status", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-task-update-user`,
        username: "testuser",
      }).returning();

      const [repo] = await db.insert(schema.repos).values({
        userId: user.id,
        githubRepoId: "repo-12345",
        name: "my-repo",
        fullName: "testuser/my-repo",
        cloneUrl: "https://github.com/testuser/my-repo.git",
      }).returning();

      const [task] = await db.insert(schema.tasks).values({
        repoId: repo.id,
        title: "Test task",
      }).returning();

      await db
        .update(schema.tasks)
        .set({ status: "executing" })
        .where(eq(schema.tasks.id, task.id));

      const [updatedTask] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, task.id));

      expect(updatedTask?.status).toBe("executing");
    });
  });

  describe("Task Statuses", () => {
    it("should have all expected status values", () => {
      expect(schema.taskStatuses).toContain("todo");
      expect(schema.taskStatuses).toContain("brainstorming");
      expect(schema.taskStatuses).toContain("planning");
      expect(schema.taskStatuses).toContain("ready");
      expect(schema.taskStatuses).toContain("executing");
      expect(schema.taskStatuses).toContain("done");
      expect(schema.taskStatuses).toContain("stuck");
    });
  });

  describe("Subscription Plans", () => {
    it("should create subscription plans", async () => {
      const planName = `${TEST_PREFIX}-pro`;
      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: planName,
        displayName: "Pro",
        priceMonthly: 3900,
        priceYearly: 39000,
        taskLimit: 30,
        gracePercent: 10,
        features: ["30 tasks per month", "Priority support"],
      }).returning();

      expect(plan).toBeDefined();
      expect(plan.name).toBe(planName);
      expect(plan.priceMonthly).toBe(3900);
      expect(plan.taskLimit).toBe(30);
    });
  });

  describe("User Subscriptions", () => {
    it("should create a user subscription", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-sub-user`,
        username: "testuser",
      }).returning();

      const [plan] = await db.insert(schema.subscriptionPlans).values({
        name: `${TEST_PREFIX}-sub-plan`,
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

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(user.id);
      expect(subscription.planId).toBe(plan.id);
      expect(subscription.status).toBe("active");
    });
  });

  describe("Usage Records", () => {
    it("should create a usage record", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-usage-user`,
        username: "testuser",
      }).returning();

      const [record] = await db.insert(schema.usageRecords).values({
        userId: user.id,
        periodStart: new Date(),
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 10,
      }).returning();

      expect(record).toBeDefined();
      expect(record.inputTokens).toBe(1000);
      expect(record.outputTokens).toBe(500);
      expect(record.costCents).toBe(10);
    });
  });
});
