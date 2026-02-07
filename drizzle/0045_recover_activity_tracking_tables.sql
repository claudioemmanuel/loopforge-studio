-- Recovery migration: restore activity tracking tables that may be missing
-- due to historical duplicate 0023 migration tags.

DO $$ BEGIN
  CREATE TYPE "activity_event_category" AS ENUM ('ai_action', 'git', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "blocked_by_ids" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "auto_execute_when_unblocked" boolean DEFAULT false;
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "dependency_priority" integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE CASCADE,
  "repo_id" uuid REFERENCES "repos"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "execution_id" uuid REFERENCES "executions"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "event_category" "activity_event_category" NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "activity_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "repo_id" uuid REFERENCES "repos"("id") ON DELETE CASCADE,
  "date" timestamp NOT NULL,
  "tasks_completed" integer DEFAULT 0,
  "tasks_failed" integer DEFAULT 0,
  "commits" integer DEFAULT 0,
  "files_changed" integer DEFAULT 0,
  "tokens_used" integer DEFAULT 0,
  "summary_text" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "task_dependencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "blocked_by_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "task_dependencies_unique" UNIQUE ("task_id", "blocked_by_id")
);

CREATE INDEX IF NOT EXISTS "activity_events_task_id_idx"
  ON "activity_events" ("task_id");
CREATE INDEX IF NOT EXISTS "activity_events_repo_id_idx"
  ON "activity_events" ("repo_id");
CREATE INDEX IF NOT EXISTS "activity_events_user_id_idx"
  ON "activity_events" ("user_id");
CREATE INDEX IF NOT EXISTS "activity_events_created_at_idx"
  ON "activity_events" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_events_category_idx"
  ON "activity_events" ("event_category");

CREATE INDEX IF NOT EXISTS "activity_summaries_user_id_idx"
  ON "activity_summaries" ("user_id");
CREATE INDEX IF NOT EXISTS "activity_summaries_repo_id_idx"
  ON "activity_summaries" ("repo_id");
CREATE INDEX IF NOT EXISTS "activity_summaries_date_idx"
  ON "activity_summaries" ("date" DESC);

CREATE INDEX IF NOT EXISTS "task_dependencies_task_id_idx"
  ON "task_dependencies" ("task_id");
CREATE INDEX IF NOT EXISTS "task_dependencies_blocked_by_id_idx"
  ON "task_dependencies" ("blocked_by_id");

CREATE INDEX IF NOT EXISTS "tasks_blocked_by_ids_idx"
  ON "tasks" USING GIN ("blocked_by_ids");
