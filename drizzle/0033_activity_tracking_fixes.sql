-- Phase 2.3: Activity Tracking System
-- Add missing title and taskId columns to execution_events table

-- Add taskId column (nullable to support existing records without tasks)
ALTER TABLE "execution_events" ADD COLUMN "task_id" uuid REFERENCES "tasks"("id") ON DELETE CASCADE;

-- Add title column (nullable for backwards compatibility)
ALTER TABLE "execution_events" ADD COLUMN "title" text;

-- Update existing records to have a title based on event_type
-- Only handle event types that exist in the execution_event_type enum:
-- ('thinking', 'file_read', 'file_write', 'command_run', 'commit', 'error', 'complete', 'stuck')
UPDATE "execution_events" SET "title" = CASE
  WHEN "event_type" = 'thinking' THEN 'AI Thinking'
  WHEN "event_type" = 'file_read' THEN 'File Read'
  WHEN "event_type" = 'file_write' THEN 'File Written'
  WHEN "event_type" = 'command_run' THEN 'Command Executed'
  WHEN "event_type" = 'commit' THEN 'Code Committed'
  WHEN "event_type" = 'error' THEN 'Error Occurred'
  WHEN "event_type" = 'complete' THEN 'Execution Complete'
  WHEN "event_type" = 'stuck' THEN 'Task Stuck'
  ELSE 'Event'
END
WHERE "title" IS NULL;

-- Update existing records to link to tasks via executions table
UPDATE "execution_events" ee
SET "task_id" = e."task_id"
FROM "executions" e
WHERE ee."execution_id" = e."id" AND ee."task_id" IS NULL;
