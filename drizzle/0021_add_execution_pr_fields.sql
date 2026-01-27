-- Add branch and PR fields to executions table
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "branch" text;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "pr_url" text;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "pr_number" integer;
