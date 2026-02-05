-- Add PR configuration columns to tasks table
-- Allows per-task PR settings (branch target, draft mode)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pr_target_branch TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pr_draft BOOLEAN;
