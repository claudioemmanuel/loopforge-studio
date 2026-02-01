-- Migration: Add auto_approve and test gate configuration to repos table
-- Date: 2026-01-31
-- Purpose: Add missing columns that were defined in schema but never migrated

-- Add auto_approve column
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "auto_approve" boolean NOT NULL DEFAULT false;

-- Add test gate configuration columns
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "test_gate_policy" text DEFAULT 'warn';
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "critical_test_patterns" jsonb DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN "repos"."auto_approve" IS 'When true, automatically commit and push changes when tests pass';
COMMENT ON COLUMN "repos"."test_gate_policy" IS 'Test failure policy: strict | warn | skip | autoApprove';
COMMENT ON COLUMN "repos"."critical_test_patterns" IS 'Array of test name patterns that must pass (e.g., ["auth", "payment"])';
