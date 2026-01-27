-- Add PR fields to tasks table
ALTER TABLE "tasks" ADD COLUMN "pr_url" text;
ALTER TABLE "tasks" ADD COLUMN "pr_number" integer;
