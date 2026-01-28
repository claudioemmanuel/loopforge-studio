-- Add indexing status enum
DO $$ BEGIN
  CREATE TYPE "public"."indexing_status" AS ENUM('pending', 'indexing', 'indexed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add indexing fields to repos table
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "local_path" text;
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "is_cloned" boolean NOT NULL DEFAULT false;
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "cloned_at" timestamp;
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "indexing_status" "indexing_status" NOT NULL DEFAULT 'pending';
ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "indexed_at" timestamp;

-- Create repo_index table for storing repository index metadata
CREATE TABLE IF NOT EXISTS "repo_index" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_id" uuid NOT NULL UNIQUE,
  "file_count" integer,
  "symbol_count" integer,
  "tech_stack" jsonb,
  "entry_points" jsonb,
  "dependencies" jsonb,
  "file_index" jsonb,
  "symbol_index" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
DO $$ BEGIN
  ALTER TABLE "repo_index" ADD CONSTRAINT "repo_index_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create index on repo_id for faster lookups
CREATE INDEX IF NOT EXISTS "repo_index_repo_id_idx" ON "repo_index" ("repo_id");

-- Create index on indexing_status for filtering repos by status
CREATE INDEX IF NOT EXISTS "repos_indexing_status_idx" ON "repos" ("indexing_status");
