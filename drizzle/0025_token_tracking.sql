-- Migration: Add token tracking to executions table
-- Created: 2026-01-29
-- Purpose: Track token usage metrics per execution phase (brainstorm, planning, execution)

-- Add token_metrics column to executions table
ALTER TABLE executions
ADD COLUMN token_metrics JSONB DEFAULT '{}';

COMMENT ON COLUMN executions.token_metrics IS
'Phase-specific token usage: { brainstorm: {input, output, total, cost}, plan: {input, output, total, cost}, execution: {input, output, total, cost} }';

-- Add indices for analytics queries on usage_records
CREATE INDEX IF NOT EXISTS idx_usage_records_user_period
ON usage_records(user_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_usage_records_task
ON usage_records(task_id)
WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_records_execution
ON usage_records(execution_id)
WHERE execution_id IS NOT NULL;
