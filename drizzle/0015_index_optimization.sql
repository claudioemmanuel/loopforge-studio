-- Migration: Add performance indexes for query optimization
-- This migration adds indexes to improve query performance on hot paths

-- =====================================================
-- CRITICAL FK INDEXES (missing in schema)
-- =====================================================

-- repos.user_id: Every authenticated request queries by user
CREATE INDEX IF NOT EXISTS idx_repos_user_id ON repos(user_id);

-- tasks.repo_id: Kanban board, workers list, analytics all filter by repo
CREATE INDEX IF NOT EXISTS idx_tasks_repo_id ON tasks(repo_id);

-- executions.task_id: Worker detail views, history lookups
CREATE INDEX IF NOT EXISTS idx_executions_task_id ON executions(task_id);

-- =====================================================
-- COMPOSITE INDEXES (for complex queries)
-- =====================================================

-- executions: DISTINCT ON queries need this for efficiency
CREATE INDEX IF NOT EXISTS idx_executions_task_created_desc
ON executions(task_id, created_at DESC);

-- worker_jobs: Worker history lookups filter by task and status
CREATE INDEX IF NOT EXISTS idx_worker_jobs_task_status
ON worker_jobs(task_id, status);

-- worker_jobs: Query by job_id for status updates
CREATE INDEX IF NOT EXISTS idx_worker_jobs_job_id
ON worker_jobs(job_id) WHERE job_id IS NOT NULL;

-- =====================================================
-- PARTIAL INDEXES (for hot paths with specific conditions)
-- =====================================================

-- tasks: Currently processing tasks (shown in workers list)
CREATE INDEX IF NOT EXISTS idx_tasks_processing
ON tasks(repo_id, updated_at DESC)
WHERE processing_phase IS NOT NULL;

-- tasks: Active tasks (most common kanban board filter)
CREATE INDEX IF NOT EXISTS idx_tasks_active_status
ON tasks(repo_id, status, updated_at DESC)
WHERE status IN ('todo', 'brainstorming', 'planning', 'ready', 'executing');

-- user_subscriptions: Active subscription lookup (common billing check)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active
ON user_subscriptions(user_id)
WHERE status = 'active';

-- =====================================================
-- ANALYTICS INDEXES
-- =====================================================

-- usage_records: Analytics queries by user and period
CREATE INDEX IF NOT EXISTS idx_usage_records_user_period
ON usage_records(user_id, period_start);

-- worker_jobs: Analytics by created date
CREATE INDEX IF NOT EXISTS idx_worker_jobs_created
ON worker_jobs(created_at DESC);
