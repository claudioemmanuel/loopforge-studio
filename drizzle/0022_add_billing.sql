-- Add billing infrastructure for SaaS model
-- Supports both BYOK (Bring Your Own Key) and Managed (we provide AI) modes

-- =============================================================================
-- Enums
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "billing_mode" AS ENUM ('byok', 'managed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "billing_cycle" AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM ('active', 'canceled', 'past_due', 'trialing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Add billing columns to users table
-- =============================================================================

ALTER TABLE "users" ADD COLUMN "billing_mode" "billing_mode" DEFAULT 'byok';
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;

-- =============================================================================
-- Subscription plans table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "tier" text NOT NULL,
  "billing_mode" "billing_mode" NOT NULL,
  "price_monthly" integer NOT NULL,
  "price_yearly" integer NOT NULL,
  "limits" jsonb NOT NULL,
  "stripe_price_id_monthly" text,
  "stripe_price_id_yearly" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Ensure unique tier + billing mode combination
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_tier_mode_unique" UNIQUE ("tier", "billing_mode");

-- =============================================================================
-- User subscriptions table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id"),
  "status" "subscription_status" NOT NULL DEFAULT 'active',
  "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'monthly',
  "stripe_subscription_id" text,
  "current_period_start" timestamp NOT NULL,
  "current_period_end" timestamp NOT NULL,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- One subscription per user
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_unique" UNIQUE ("user_id");

-- =============================================================================
-- Usage records table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "usage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
  "execution_id" uuid REFERENCES "executions"("id") ON DELETE SET NULL,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "estimated_cost" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Index for efficient usage queries
CREATE INDEX "usage_records_user_period_idx" ON "usage_records" ("user_id", "period_start", "period_end");
CREATE INDEX "usage_records_task_idx" ON "usage_records" ("task_id");
