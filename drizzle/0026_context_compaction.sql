-- Migration: Add context compaction tracking to tasks table
-- Created: 2026-01-29
-- Purpose: Support hybrid sliding window + AI summarization for brainstorming conversations

-- Add context compaction columns to tasks table
ALTER TABLE tasks
ADD COLUMN brainstorm_summary TEXT,
ADD COLUMN brainstorm_message_count INTEGER DEFAULT 0,
ADD COLUMN brainstorm_compacted_at TIMESTAMP;

COMMENT ON COLUMN tasks.brainstorm_summary IS
'Compressed summary of older brainstorm messages (keeps last 8 full messages)';

COMMENT ON COLUMN tasks.brainstorm_message_count IS
'Total number of messages in original conversation before compaction';

COMMENT ON COLUMN tasks.brainstorm_compacted_at IS
'Timestamp of last compaction operation';
