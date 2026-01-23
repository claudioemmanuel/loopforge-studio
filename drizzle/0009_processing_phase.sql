-- Processing phase enum for tracking async card operations
CREATE TYPE "public"."processing_phase" AS ENUM('brainstorming', 'planning', 'executing');

-- Add processing state columns to tasks table
ALTER TABLE "tasks" ADD COLUMN "processing_phase" "processing_phase";
ALTER TABLE "tasks" ADD COLUMN "processing_job_id" text;
ALTER TABLE "tasks" ADD COLUMN "processing_started_at" timestamp;
ALTER TABLE "tasks" ADD COLUMN "processing_status_text" text;
