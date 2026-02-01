-- Phase 3.1: Subscription Tracking
-- Add subscription tier and status fields to users table

ALTER TABLE "users" ADD COLUMN "subscription_tier" text DEFAULT 'free';
ALTER TABLE "users" ADD COLUMN "subscription_status" text DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN "subscription_period_end" timestamp;

-- Migrate existing users to free tier with active status
UPDATE "users" SET "subscription_tier" = 'free', "subscription_status" = 'active' WHERE "subscription_tier" IS NULL;
