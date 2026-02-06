import { beforeAll, afterAll, beforeEach } from "vitest";
import { getTestPool, closeTestPool, truncateAllTables } from "./test-db";
import { initializeEventHandlers } from "@/lib/contexts/event-initialization";

// Run schema setup once per test file
beforeAll(async () => {
  // Initialize event handlers for tests
  await initializeEventHandlers().catch((error) => {
    console.error("Failed to initialize event handlers in tests:", error);
  });

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
    DO $$ BEGIN ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'stuck'; EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE execution_event_type AS ENUM ('thinking', 'file_read', 'file_write', 'command_run', 'commit', 'error', 'complete', 'stuck', 'setup_start', 'repo_clone', 'repo_update', 'branch_create', 'branch_checkout', 'setup_complete');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Add new event types if enum already exists
    DO $$ BEGIN ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'setup_start'; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'repo_clone'; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'repo_update'; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'branch_create'; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'branch_checkout'; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE execution_event_type ADD VALUE IF NOT EXISTS 'setup_complete'; EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai', 'gemini');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE processing_phase AS ENUM ('brainstorming', 'planning', 'executing');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Create billing_mode enum if not exists
    DO $$ BEGIN
      CREATE TYPE billing_mode AS ENUM ('byok', 'managed');
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
      default_clone_directory TEXT,
      billing_mode billing_mode,
      stripe_customer_id TEXT,
      onboarding_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add billing columns if they don't exist
    ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_mode billing_mode;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';
    -- Add workflow settings columns if they don't exist
    ALTER TABLE users ADD COLUMN IF NOT EXISTS default_clone_directory TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS default_test_command TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS default_test_timeout INTEGER DEFAULT 300000;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS default_test_gate_policy TEXT DEFAULT 'warn';

    DO $$ BEGIN
      CREATE TYPE indexing_status AS ENUM ('pending', 'indexing', 'indexed', 'failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE clone_status AS ENUM ('not_cloned', 'cloning', 'cloned', 'failed', 'updating');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE clone_status ADD VALUE IF NOT EXISTS 'pending'; EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN ALTER TYPE clone_status ADD VALUE IF NOT EXISTS 'completed'; EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS repos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      github_repo_id TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      clone_url TEXT NOT NULL,
      is_private BOOLEAN NOT NULL DEFAULT false,
      local_path TEXT,
      is_cloned BOOLEAN NOT NULL DEFAULT false,
      cloned_at TIMESTAMP,
      indexing_status indexing_status NOT NULL DEFAULT 'pending',
      indexed_at TIMESTAMP,
      -- P0: Test configuration
      test_command TEXT,
      test_timeout INTEGER DEFAULT 300000,
      tests_enabled BOOLEAN DEFAULT true,
      -- P0: PR configuration
      pr_title_template TEXT DEFAULT '[LoopForge] {{title}}',
      pr_target_branch TEXT,
      pr_draft_default BOOLEAN DEFAULT false,
      pr_reviewers JSONB,
      pr_labels JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add new columns if they don't exist (for existing test databases)
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS local_path TEXT;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS is_cloned BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS cloned_at TIMESTAMP;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS indexing_status indexing_status NOT NULL DEFAULT 'pending';
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
    -- P0: Test configuration columns
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS test_command TEXT;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS test_timeout INTEGER DEFAULT 300000;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS tests_enabled BOOLEAN DEFAULT true;
    -- P0: PR configuration columns
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_title_template TEXT DEFAULT '[LoopForge] {{title}}';
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_target_branch TEXT;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_draft_default BOOLEAN DEFAULT false;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_reviewers JSONB;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS pr_labels JSONB;
    -- Auto-approve and Ralph reliability columns
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS test_gate_policy TEXT DEFAULT 'warn';
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS critical_test_patterns JSONB DEFAULT '[]'::jsonb;
    -- Clone status tracking
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS clone_status clone_status DEFAULT 'not_cloned';
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS clone_error TEXT;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS clone_started_at TIMESTAMP;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS clone_completed_at TIMESTAMP;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS clone_path TEXT;

    -- Create trigger function to enforce repository limits
    CREATE OR REPLACE FUNCTION check_repo_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      user_tier TEXT;
      max_repos INT;
      current_count INT;
    BEGIN
      -- Get user's subscription tier
      SELECT subscription_tier INTO user_tier
      FROM users WHERE id = NEW.user_id;

      -- Get max repos for tier
      max_repos := CASE user_tier
        WHEN 'free' THEN 1
        WHEN 'pro' THEN 20
        WHEN 'enterprise' THEN -1  -- unlimited
        ELSE 1  -- default to free
      END;

      -- Skip check for enterprise (unlimited)
      IF max_repos = -1 THEN
        RETURN NEW;
      END IF;

      -- Count current repos for user (excluding the one being inserted)
      SELECT COUNT(*) INTO current_count
      FROM repos WHERE user_id = NEW.user_id;

      -- Reject if at or over limit
      IF current_count >= max_repos THEN
        RAISE EXCEPTION 'Repository limit exceeded for % tier (% / %)',
          user_tier, current_count, max_repos
          USING ERRCODE = '23514';  -- check_violation
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger on repos table
    DROP TRIGGER IF EXISTS enforce_repo_limit ON repos;
    CREATE TRIGGER enforce_repo_limit
      BEFORE INSERT ON repos
      FOR EACH ROW
      EXECUTE FUNCTION check_repo_limit();

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
      -- P0: PR configuration overrides
      pr_target_branch TEXT,
      pr_draft BOOLEAN,
      pr_url TEXT,
      pr_number INTEGER,
      -- Task dependencies
      blocked_by_ids JSONB DEFAULT '[]',
      auto_execute_when_unblocked BOOLEAN DEFAULT false,
      dependency_priority INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add columns if they don't exist (for existing test databases)
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pr_url TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pr_number INTEGER;
    -- P0: PR configuration overrides
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pr_target_branch TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pr_draft BOOLEAN;
    -- Auto-approve column (task-level control)
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT false;
    -- Brainstorm summary column
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS brainstorm_summary TEXT;
    -- Context compaction columns (Prompt Engineering Framework 2026-01-29)
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS brainstorm_message_count INTEGER DEFAULT 0;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS brainstorm_compacted_at TIMESTAMP;
    -- Execution graph for DAG visualization (Task Detail Visualization 2026-02-01)
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_graph JSONB;

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
      branch TEXT,
      pr_url TEXT,
      pr_number INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add new execution columns if they don't exist
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS branch TEXT;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS pr_url TEXT;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS pr_number INTEGER;
    -- P0: Rollback tracking
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS reverted BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS revert_commit_sha TEXT;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMP;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS revert_reason TEXT;
    -- Ralph Loop Reliability Features (2026-01-29)
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS stuck_signals JSONB;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS recovery_attempts JSONB;
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS validation_report JSONB;
    -- Token tracking (Prompt Engineering Framework 2026-01-29)
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS token_metrics JSONB DEFAULT '{}'::jsonb;
    -- Skills tracking (Skills Framework Integration 2026-01-29)
    ALTER TABLE executions ADD COLUMN IF NOT EXISTS skill_executions JSONB DEFAULT '[]'::jsonb;

    CREATE TABLE IF NOT EXISTS execution_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      event_type execution_event_type NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS execution_commits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      commit_sha TEXT NOT NULL,
      commit_message TEXT NOT NULL,
      files_changed JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_reverted BOOLEAN NOT NULL DEFAULT false,
      reverted_at TIMESTAMP,
      revert_sha TEXT
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      command TEXT NOT NULL,
      exit_code INTEGER,
      stdout TEXT,
      stderr TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS repo_index (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      repo_id UUID NOT NULL UNIQUE REFERENCES repos(id) ON DELETE CASCADE,
      file_count INTEGER,
      symbol_count INTEGER,
      tech_stack JSONB,
      entry_points JSONB,
      dependencies JSONB,
      file_index JSONB,
      symbol_index JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add unique constraint on repos if not exists
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'repos_user_github_unique'
      ) THEN
        ALTER TABLE repos ADD CONSTRAINT repos_user_github_unique UNIQUE (user_id, github_repo_id);
      END IF;
    END $$;

    -- =========================================
    -- Kanban Enhancement Tables
    -- =========================================

    -- Add task status 'review' if not exists
    DO $$ BEGIN ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'review'; EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Create activity_event_category enum if not exists
    DO $$ BEGIN
      CREATE TYPE activity_event_category AS ENUM ('ai_action', 'git', 'system', 'test', 'review');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Add dependency columns to tasks table
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by_ids JSONB DEFAULT '[]';
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_execute_when_unblocked BOOLEAN DEFAULT false;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency_priority INTEGER DEFAULT 0;

    -- Create activity_events table
    CREATE TABLE IF NOT EXISTS activity_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
      repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      event_category activity_event_category NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    -- Create activity_summaries table
    CREATE TABLE IF NOT EXISTS activity_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
      date TIMESTAMP NOT NULL,
      tasks_completed INTEGER DEFAULT 0,
      tasks_failed INTEGER DEFAULT 0,
      commits INTEGER DEFAULT 0,
      files_changed INTEGER DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      summary_text TEXT,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    );

    -- Create task_dependencies junction table
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      blocked_by_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      CONSTRAINT task_dependencies_unique UNIQUE(task_id, blocked_by_id)
    );

    -- Create indexes for activity tables
    CREATE INDEX IF NOT EXISTS activity_events_task_id_idx ON activity_events(task_id);
    CREATE INDEX IF NOT EXISTS activity_events_repo_id_idx ON activity_events(repo_id);
    CREATE INDEX IF NOT EXISTS activity_events_user_id_idx ON activity_events(user_id);
    CREATE INDEX IF NOT EXISTS activity_events_created_at_idx ON activity_events(created_at DESC);

    CREATE INDEX IF NOT EXISTS activity_summaries_user_id_idx ON activity_summaries(user_id);
    CREATE INDEX IF NOT EXISTS activity_summaries_date_idx ON activity_summaries(date DESC);

    CREATE INDEX IF NOT EXISTS task_dependencies_task_id_idx ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS task_dependencies_blocked_by_id_idx ON task_dependencies(blocked_by_id);

    -- =========================================
    -- A/B Testing Tables
    -- =========================================

    CREATE TABLE IF NOT EXISTS experiments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      traffic_allocation INTEGER NOT NULL DEFAULT 10,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS experiment_variants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      weight INTEGER NOT NULL DEFAULT 50,
      config JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT experiment_variants_experiment_name_unique UNIQUE(experiment_id, name)
    );

    CREATE TABLE IF NOT EXISTS variant_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      variant_id UUID NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
      assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT variant_assignments_experiment_task_unique UNIQUE(experiment_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS experiment_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_assignment_id UUID NOT NULL REFERENCES variant_assignments(id) ON DELETE CASCADE,
      metric_name VARCHAR(100) NOT NULL,
      metric_value INTEGER NOT NULL,
      metadata JSONB,
      recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_experiment_variants_experiment_id ON experiment_variants(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_variant_assignments_experiment_id ON variant_assignments(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_variant_assignments_variant_id ON variant_assignments(variant_id);
    CREATE INDEX IF NOT EXISTS idx_variant_assignments_task_id ON variant_assignments(task_id);
    CREATE INDEX IF NOT EXISTS idx_experiment_metrics_assignment_id ON experiment_metrics(variant_assignment_id);

    -- =========================================
    -- Domain Events (DDD Architecture)
    -- =========================================

    CREATE TABLE IF NOT EXISTS domain_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      occurred_at TIMESTAMP DEFAULT now() NOT NULL,
      persisted_at TIMESTAMP DEFAULT now() NOT NULL,
      data JSONB DEFAULT '{}'::jsonb NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      version INTEGER DEFAULT 1 NOT NULL
    );

    -- Create indexes for domain_events
    CREATE INDEX IF NOT EXISTS idx_domain_events_event_type ON domain_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
    CREATE INDEX IF NOT EXISTS idx_domain_events_occurred_at ON domain_events(occurred_at DESC);

    -- =========================================
    -- Usage Records (Billing Context)
    -- =========================================

    CREATE TABLE IF NOT EXISTS usage_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
      execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Create indexes for usage_records
    CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period_start, period_end);

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
