-- Migration: Add persisted automation default behaviors to users table
-- Purpose: support node-based automation settings wizard

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "default_branch_prefix" text DEFAULT 'loopforge/';

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "require_plan_approval" boolean DEFAULT true;

UPDATE "users"
SET
  "default_branch_prefix" = COALESCE("default_branch_prefix", 'loopforge/'),
  "require_plan_approval" = COALESCE("require_plan_approval", true)
WHERE
  "default_branch_prefix" IS NULL
  OR "require_plan_approval" IS NULL;

COMMENT ON COLUMN "users"."default_branch_prefix" IS 'Default git branch prefix for automation-generated branches';
COMMENT ON COLUMN "users"."require_plan_approval" IS 'Require plan approval before execution in automated workflows';
