import { beforeAll, afterAll, beforeEach } from "vitest";
import { getTestPool, closeTestPool, truncateAllTables } from "./test-db";

// Run schema setup once per test file
beforeAll(async () => {
  const pool = getTestPool();

  // Create enums and tables if they don't exist
  await pool.query(`
    -- Create enums if they don't exist
    DO $$ BEGIN
      CREATE TYPE task_status AS ENUM ('todo', 'brainstorming', 'planning', 'ready', 'executing', 'done', 'stuck');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE execution_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE execution_event_type AS ENUM ('thinking', 'file_read', 'file_write', 'command_run', 'commit', 'error', 'complete', 'stuck');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai', 'gemini');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE processing_phase AS ENUM ('brainstorming', 'planning', 'executing');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Create tables if they don't exist
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      github_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      encrypted_api_key TEXT,
      api_key_iv TEXT,
      openai_encrypted_api_key TEXT,
      openai_api_key_iv TEXT,
      gemini_encrypted_api_key TEXT,
      gemini_api_key_iv TEXT,
      encrypted_github_token TEXT,
      github_token_iv TEXT,
      preferred_anthropic_model TEXT DEFAULT 'claude-sonnet-4-20250514',
      preferred_openai_model TEXT DEFAULT 'gpt-4o',
      preferred_gemini_model TEXT DEFAULT 'gemini-2.5-pro',
      preferred_provider ai_provider DEFAULT 'anthropic',
      onboarding_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS repos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      github_repo_id TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      clone_url TEXT NOT NULL,
      is_private BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status task_status NOT NULL DEFAULT 'todo',
      priority INTEGER NOT NULL DEFAULT 0,
      brainstorm_result TEXT,
      brainstorm_conversation TEXT,
      plan_content TEXT,
      branch TEXT,
      autonomous_mode BOOLEAN NOT NULL DEFAULT false,
      processing_phase processing_phase,
      processing_job_id TEXT,
      processing_started_at TIMESTAMP,
      processing_status_text TEXT,
      processing_progress INTEGER DEFAULT 0,
      status_history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add status_history column if it doesn't exist (for existing test databases)
    DO $$ BEGIN
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
    EXCEPTION WHEN undefined_table THEN null; END $$;

    CREATE TABLE IF NOT EXISTS executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      status execution_status NOT NULL DEFAULT 'queued',
      iteration INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      error_message TEXT,
      logs_path TEXT,
      commits JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS execution_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      event_type execution_event_type NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

  `);
});

// Truncate tables before each test
beforeEach(async () => {
  await truncateAllTables();
});

// Close pool after all tests in file
afterAll(async () => {
  await closeTestPool();
});
