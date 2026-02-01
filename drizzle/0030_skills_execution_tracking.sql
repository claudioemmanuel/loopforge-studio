-- Migration: Skills Execution Tracking
-- Date: 2026-01-29
-- Description: Adds skill_executions column to executions table for tracking skill usage

ALTER TABLE executions ADD COLUMN skill_executions JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the schema
COMMENT ON COLUMN executions.skill_executions IS 'Array of skill execution records: [{ skillId, status, message, timestamp, metadata }]';
