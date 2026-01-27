-- Migration: 0023_p0_features
-- Features: Diff Preview, Test Execution, PR Enhancement, Rollback
-- Date: 2026-01-27

-- =============================================================================
-- 1. Add 'review' status to task_status enum
-- =============================================================================
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'review' AFTER 'executing';

-- =============================================================================
-- 2. Create pending_change_action enum
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE pending_change_action AS ENUM ('create', 'modify', 'delete');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 3. Create test_run_status enum
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE test_run_status AS ENUM ('running', 'passed', 'failed', 'timeout', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 4. Pending changes table (Diff Preview)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  action pending_change_action NOT NULL,
  old_content TEXT,
  new_content TEXT NOT NULL,
  diff_patch TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(execution_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_pending_changes_execution ON pending_changes(execution_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_task ON pending_changes(task_id);

-- =============================================================================
-- 5. Test runs table (Test Execution)
-- =============================================================================
CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  duration_ms INTEGER,
  status test_run_status NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(execution_id)
);

CREATE INDEX IF NOT EXISTS idx_test_runs_task ON test_runs(task_id);

-- =============================================================================
-- 6. Execution commits table (Rollback tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS execution_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  files_changed JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_reverted BOOLEAN NOT NULL DEFAULT FALSE,
  reverted_at TIMESTAMP,
  revert_sha TEXT,
  UNIQUE(execution_id, commit_sha)
);

CREATE INDEX IF NOT EXISTS idx_execution_commits_execution ON execution_commits(execution_id);

-- =============================================================================
-- 7. Repo configuration columns (Test + PR settings)
-- =============================================================================
-- Test configuration
ALTER TABLE repos ADD COLUMN IF NOT EXISTS test_command TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS test_timeout INTEGER DEFAULT 300000;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS tests_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- PR configuration
ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_title_template TEXT DEFAULT '[LoopForge] {{title}}';
ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_target_branch TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_draft_default BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_reviewers JSONB;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_labels JSONB;

-- =============================================================================
-- 8. Execution rollback columns
-- =============================================================================
ALTER TABLE executions ADD COLUMN IF NOT EXISTS reverted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS revert_commit_sha TEXT;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMP;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS revert_reason TEXT;
