-- Phase 2.2: Clone Status System
-- Add clone status tracking fields to repos table

ALTER TABLE "repos" ADD COLUMN "clone_status" text DEFAULT 'pending';
ALTER TABLE "repos" ADD COLUMN "clone_path" text;
ALTER TABLE "repos" ADD COLUMN "clone_started_at" timestamp;
ALTER TABLE "repos" ADD COLUMN "clone_completed_at" timestamp;

-- Migrate existing data: set clone_status based on is_cloned
UPDATE "repos" SET "clone_status" = 'completed' WHERE "is_cloned" = true;
UPDATE "repos" SET "clone_status" = 'pending' WHERE "is_cloned" = false;

-- Set clone_completed_at from cloned_at for existing cloned repos
UPDATE "repos" SET "clone_completed_at" = "cloned_at" WHERE "is_cloned" = true AND "cloned_at" IS NOT NULL;

-- Set clone_path from local_path for existing cloned repos
UPDATE "repos" SET "clone_path" = "local_path" WHERE "is_cloned" = true AND "local_path" IS NOT NULL;
