-- Migration: Add all missing columns from schema
-- Date: 2026-01-31
-- Purpose: Comprehensive fix for schema/database mismatch

-- Tasks table missing columns
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_by_ids" jsonb DEFAULT '[]';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "auto_execute_when_unblocked" boolean DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dependency_priority" integer DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_tasks_blocked_by" ON "tasks" USING GIN ("blocked_by_ids");
CREATE INDEX IF NOT EXISTS "idx_tasks_dependency_priority" ON "tasks" ("dependency_priority");

-- Add comments
COMMENT ON COLUMN "tasks"."blocked_by_ids" IS 'Array of task IDs that must complete before this task can start';
COMMENT ON COLUMN "tasks"."auto_execute_when_unblocked" IS 'When true, automatically move to ready when all blocking tasks complete';
COMMENT ON COLUMN "tasks"."dependency_priority" IS 'Higher priority tasks execute first when multiple tasks become unblocked';
