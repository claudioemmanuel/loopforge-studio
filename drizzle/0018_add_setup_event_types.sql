-- Add setup phase event types to execution_event_type enum
-- These events track the setup phase of execution (repo cloning, branch management)

ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'setup_start';
ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'repo_clone';
ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'repo_update';
ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'branch_create';
ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'branch_checkout';
ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'setup_complete';
