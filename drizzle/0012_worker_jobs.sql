-- Worker History Tables Migration
-- Tracks all background processing jobs (brainstorming, planning, executing)

-- Create enums for worker jobs
DO $$ BEGIN
  CREATE TYPE "worker_job_phase" AS ENUM('brainstorming', 'planning', 'executing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "worker_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "worker_event_type" AS ENUM('thinking', 'action', 'file_read', 'file_write', 'api_call', 'error', 'complete');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create worker_jobs table
CREATE TABLE IF NOT EXISTS "worker_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "phase" "worker_job_phase" NOT NULL,
  "status" "worker_job_status" NOT NULL DEFAULT 'queued',
  "started_at" timestamp,
  "completed_at" timestamp,
  "error_message" text,
  "result_summary" text,
  "job_id" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create worker_events table
CREATE TABLE IF NOT EXISTS "worker_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "worker_job_id" uuid NOT NULL REFERENCES "worker_jobs"("id") ON DELETE CASCADE,
  "event_type" "worker_event_type" NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_worker_jobs_task_id" ON "worker_jobs"("task_id");
CREATE INDEX IF NOT EXISTS "idx_worker_jobs_status" ON "worker_jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_worker_jobs_phase" ON "worker_jobs"("phase");
CREATE INDEX IF NOT EXISTS "idx_worker_jobs_completed_at" ON "worker_jobs"("completed_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_worker_jobs_created_at" ON "worker_jobs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_worker_events_job_id" ON "worker_events"("worker_job_id");
CREATE INDEX IF NOT EXISTS "idx_worker_events_created_at" ON "worker_events"("created_at" DESC);
