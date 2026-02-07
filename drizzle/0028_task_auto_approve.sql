-- Migration: Add auto_approve column to tasks table
-- Date: 2026-01-29
-- Purpose: Move auto-approve functionality from repo-level to task-level

-- Add column with default false
ALTER TABLE "tasks" ADD COLUMN "auto_approve" boolean NOT NULL DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "idx_tasks_auto_approve" ON "tasks" ("auto_approve");

-- Migrate existing repo-level auto_approve settings to tasks (if column exists)
-- This ensures existing tasks inherit their repo's auto_approve preference
-- Note: This will run again in migration 0036 when repos.auto_approve is actually added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repos' AND column_name = 'auto_approve'
  ) THEN
    UPDATE "tasks" t
    SET "auto_approve" = r."auto_approve"
    FROM "repos" r
    WHERE t."repo_id" = r."id"
      AND r."auto_approve" = true;
  END IF;
END $$;

-- Add column comment for documentation
COMMENT ON COLUMN "tasks"."auto_approve" IS 'When true, automatically commit and push changes when tests pass. Set per-task for granular control.';
