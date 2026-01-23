-- Migration: Add unique constraints to prevent race condition duplicates
-- This prevents duplicate repos and subscriptions caused by TOCTOU race conditions

-- Add unique constraint on repos table for (user_id, github_repo_id)
-- This ensures a user cannot have the same GitHub repo linked twice
ALTER TABLE "repos" ADD CONSTRAINT "repos_user_github_unique" UNIQUE ("user_id", "github_repo_id");

-- Add unique constraint on user_subscriptions table for stripe_subscription_id
-- This ensures we don't create duplicate subscription records from webhook retries
-- Note: stripe_subscription_id can be null, so we use a partial unique index
CREATE UNIQUE INDEX "user_subscriptions_stripe_id_unique" ON "user_subscriptions" ("stripe_subscription_id") WHERE "stripe_subscription_id" IS NOT NULL;
