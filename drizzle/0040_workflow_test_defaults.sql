-- Migration: Add test defaults to users table
-- Date: 2026-02-01
-- Purpose: Allow users to set global test defaults for new repositories

-- Add test default columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_test_command" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_test_timeout" integer DEFAULT 300000;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_test_gate_policy" text DEFAULT 'warn';

-- Add comments for documentation
COMMENT ON COLUMN "users"."default_test_command" IS 'Default test command for new repositories (e.g., npm test)';
COMMENT ON COLUMN "users"."default_test_timeout" IS 'Default test timeout in milliseconds (default: 300000 = 5 minutes)';
COMMENT ON COLUMN "users"."default_test_gate_policy" IS 'Default test gate policy: strict | warn | skip | autoApprove';
