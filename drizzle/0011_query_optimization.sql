-- Query optimization indexes
-- These indexes target the hottest query patterns identified in the codebase

-- Tasks by repo + status + updated (hot query for Kanban board and workers)
CREATE INDEX IF NOT EXISTS idx_tasks_repo_status_updated
ON tasks(repo_id, status, updated_at DESC);

-- Executions by task + status + created (usage checks for billing)
CREATE INDEX IF NOT EXISTS idx_executions_task_status_created
ON executions(task_id, status, created_at DESC);

-- Execution events by execution + created (timeline queries)
CREATE INDEX IF NOT EXISTS idx_execution_events_exec_created
ON execution_events(execution_id, created_at ASC);

-- User subscriptions by user + status (billing checks)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
ON user_subscriptions(user_id, status);

-- Usage records by user + created (analytics)
CREATE INDEX IF NOT EXISTS idx_usage_records_user_created
ON usage_records(user_id, created_at DESC);

-- Partial index for autonomous tasks (workers page)
CREATE INDEX IF NOT EXISTS idx_tasks_autonomous
ON tasks(repo_id, updated_at DESC)
WHERE autonomous_mode = true;
