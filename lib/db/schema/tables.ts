import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import type { ExecutionEventMetadata } from "@/lib/ralph/types";
import type { ExperimentVariantConfig } from "./types";
import type { ExecutionGraph } from "@/lib/shared/graph-types";
import {
  taskStatusEnum,
  executionStatusEnum,
  executionEventTypeEnum,
  aiProviderEnum,
  processingPhaseEnum,
  workerJobPhaseEnum,
  workerJobStatusEnum,
  workerEventTypeEnum,
  activityEventCategoryEnum,
  billingModeEnum,
  billingCycleEnum,
  subscriptionStatusEnum,
  indexingStatusEnum,
  pendingChangeActionEnum,
  testRunStatusEnum,
} from "./enums";
import type {
  StatusHistoryEntry,
  WorkerEventMetadata,
  RepoIndexTechStack,
  RepoIndexEntryPoint,
  RepoIndexDependency,
  RepoIndexFileEntry,
  RepoIndexSymbol,
  PlanLimits,
  ActivityEventMetadata,
  PhaseTokenMetrics,
} from "./types";

// =============================================================================
// Core Tables
// =============================================================================

// Domain Events table (for DDD architecture)
export const domainEvents = pgTable("domain_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  persistedAt: timestamp("persisted_at").notNull().defaultNow(),
  data: jsonb("data").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),
  version: integer("version").notNull().default(1),
});

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull().unique(),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  encryptedApiKey: text("encrypted_api_key"), // Anthropic API key (legacy column name)
  apiKeyIv: text("api_key_iv"), // Anthropic API key IV
  openaiEncryptedApiKey: text("openai_encrypted_api_key"),
  openaiApiKeyIv: text("openai_api_key_iv"),
  geminiEncryptedApiKey: text("gemini_encrypted_api_key"),
  geminiApiKeyIv: text("gemini_api_key_iv"),
  preferredAnthropicModel: text("preferred_anthropic_model").default(
    "claude-sonnet-4-20250514",
  ),
  preferredOpenaiModel: text("preferred_openai_model").default("gpt-4o"),
  preferredGeminiModel: text("preferred_gemini_model").default(
    "gemini-2.5-pro",
  ),
  preferredProvider: aiProviderEnum("preferred_provider").default("anthropic"),
  encryptedGithubToken: text("encrypted_github_token"),
  githubTokenIv: text("github_token_iv"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  // Workflow settings
  defaultCloneDirectory: text("default_clone_directory"),
  // Test defaults (Workflow Settings Expansion 2026-02-01)
  defaultTestCommand: text("default_test_command"),
  defaultTestTimeout: integer("default_test_timeout").default(300000), // 5 minutes default
  defaultTestGatePolicy: text("default_test_gate_policy").default("warn"), // strict | warn | skip | autoApprove
  // Automation defaults (Workflow Automation Wizard 2026-02-07)
  defaultBranchPrefix: text("default_branch_prefix").default("loopforge/"),
  requirePlanApproval: boolean("require_plan_approval").default(true),
  // Billing fields
  billingMode: billingModeEnum("billing_mode").default("byok"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionTier: text("subscription_tier").default("free"), // free | pro | enterprise
  subscriptionStatus: text("subscription_status").default("active"), // active | canceled | past_due
  subscriptionPeriodEnd: timestamp("subscription_period_end"),
  locale: text("locale").default("en"), // User's language preference (en | pt-BR)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Repositories table
export const repos = pgTable(
  "repos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubRepoId: text("github_repo_id").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    cloneUrl: text("clone_url").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    // Local clone management
    localPath: text("local_path"),
    isCloned: boolean("is_cloned").notNull().default(false),
    clonedAt: timestamp("cloned_at"),
    // Clone status tracking (Phase 2.2)
    cloneStatus: text("clone_status").default("pending"), // pending | cloning | completed | failed
    clonePath: text("clone_path"),
    cloneStartedAt: timestamp("clone_started_at"),
    cloneCompletedAt: timestamp("clone_completed_at"),
    // Indexing status
    indexingStatus: indexingStatusEnum("indexing_status")
      .notNull()
      .default("pending"),
    indexedAt: timestamp("indexed_at"),
    // P0: Test configuration
    testCommand: text("test_command"),
    testTimeout: integer("test_timeout").default(300000), // 5 minutes default
    testsEnabled: boolean("tests_enabled").notNull().default(true),
    // P0: PR configuration
    prTitleTemplate: text("pr_title_template").default("[LoopForge] {{title}}"),
    prTargetBranch: text("pr_target_branch"),
    prDraftDefault: boolean("pr_draft_default").notNull().default(false),
    prReviewers: jsonb("pr_reviewers").$type<string[]>(),
    prLabels: jsonb("pr_labels").$type<string[]>(),
    // Auto-approve: skip review gate when tests pass
    autoApprove: boolean("auto_approve").notNull().default(false),
    // Test gate configuration (Ralph Loop Reliability Improvements 2026-01-29)
    testGatePolicy: text("test_gate_policy").default("warn"), // strict | warn | skip | autoApprove
    criticalTestPatterns: jsonb("critical_test_patterns")
      .$type<string[]>()
      .default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Prevent duplicate repos for same user via race conditions
    unique("repos_user_github_unique").on(table.userId, table.githubRepoId),
  ],
);

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: integer("priority").notNull().default(0),
  brainstormResult: text("brainstorm_result"),
  brainstormConversation: text("brainstorm_conversation"), // JSON array of chat messages
  // Context compaction fields (Prompt Engineering Framework 2026-01-29)
  brainstormSummary: text("brainstorm_summary"),
  brainstormMessageCount: integer("brainstorm_message_count").default(0),
  brainstormCompactedAt: timestamp("brainstorm_compacted_at"),
  planContent: text("plan_content"),
  branch: text("branch"),
  autonomousMode: boolean("autonomous_mode").notNull().default(false),
  autoApprove: boolean("auto_approve").notNull().default(false),
  // Processing state tracking for async operations
  processingPhase: processingPhaseEnum("processing_phase"), // null when not processing
  processingJobId: text("processing_job_id"),
  processingStartedAt: timestamp("processing_started_at"),
  processingStatusText: text("processing_status_text"),
  processingProgress: integer("processing_progress").default(0),
  statusHistory: jsonb("status_history")
    .$type<StatusHistoryEntry[]>()
    .default([]),
  // PR info after execution
  prUrl: text("pr_url"),
  prNumber: integer("pr_number"),
  // P0: PR configuration overrides (task-level)
  prTargetBranch: text("pr_target_branch"),
  prDraft: boolean("pr_draft"),
  // Task dependency fields
  blockedByIds: jsonb("blocked_by_ids").$type<string[]>().default([]),
  autoExecuteWhenUnblocked: boolean("auto_execute_when_unblocked").default(
    false,
  ),
  dependencyPriority: integer("dependency_priority").default(0),
  // Execution graph for DAG visualization (Task Detail Visualization 2026-02-01)
  executionGraph: jsonb("execution_graph").$type<ExecutionGraph>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Executions table
export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  status: executionStatusEnum("status").notNull().default("queued"),
  iteration: integer("iteration").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  logsPath: text("logs_path"),
  commits: jsonb("commits").$type<string[]>(), // Array of commit SHAs
  // Branch and PR information
  branch: text("branch"),
  prUrl: text("pr_url"),
  prNumber: integer("pr_number"),
  // P0: Rollback tracking
  reverted: boolean("reverted").notNull().default(false),
  revertCommitSha: text("revert_commit_sha"),
  revertedAt: timestamp("reverted_at"),
  revertReason: text("revert_reason"),
  // Reliability tracking (Ralph Loop Reliability Improvements 2026-01-29)
  stuckSignals: jsonb("stuck_signals"),
  recoveryAttempts: jsonb("recovery_attempts"),
  validationReport: jsonb("validation_report"),
  // Token tracking (Prompt Engineering Framework 2026-01-29)
  tokenMetrics: jsonb("token_metrics")
    .$type<Record<string, PhaseTokenMetrics>>()
    .default({}),
  // Skills tracking (Skills Framework Integration 2026-01-29)
  skillExecutions: jsonb("skill_executions")
    .$type<
      Array<{
        skillId: string;
        status: "passed" | "warning" | "blocked";
        message: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }>
    >()
    .default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Execution events for live activity feed
export const executionEvents = pgTable("execution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .notNull()
    .references(() => executions.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  eventType: executionEventTypeEnum("event_type").notNull(),
  title: text("title"), // Phase 2.3: Activity Tracking - event title for display (nullable for backwards compat)
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<ExecutionEventMetadata>(),
  agentType: varchar("agent_type", { length: 20 }), // Task Detail Visualization 2026-02-01
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// Worker History Tables
// =============================================================================

// Worker jobs - tracks all background processing (brainstorm, plan, execute)
export const workerJobs = pgTable("worker_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  phase: workerJobPhaseEnum("phase").notNull(),
  status: workerJobStatusEnum("status").notNull().default("queued"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  resultSummary: text("result_summary"),
  jobId: varchar("job_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Worker events - timeline of actions during any job
export const workerEvents = pgTable("worker_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workerJobId: uuid("worker_job_id")
    .notNull()
    .references(() => workerJobs.id, { onDelete: "cascade" }),
  eventType: workerEventTypeEnum("event_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<WorkerEventMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Worker heartbeats - tracks worker health and uptime
export const workerHeartbeats = pgTable("worker_heartbeats", {
  id: uuid("id").primaryKey().defaultRandom(),
  workerId: text("worker_id").notNull().default("worker-1"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// Repository Indexing Tables
// =============================================================================

// Repository index table - stores indexed repo metadata
export const repoIndex = pgTable("repo_index", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" })
    .unique(),
  fileCount: integer("file_count"),
  symbolCount: integer("symbol_count"),
  techStack: jsonb("tech_stack").$type<RepoIndexTechStack>(),
  entryPoints: jsonb("entry_points").$type<RepoIndexEntryPoint[]>(),
  dependencies: jsonb("dependencies").$type<RepoIndexDependency[]>(),
  fileIndex: jsonb("file_index").$type<RepoIndexFileEntry[]>(),
  symbolIndex: jsonb("symbol_index").$type<RepoIndexSymbol[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =============================================================================
// Billing Tables
// =============================================================================

// Subscription plans - defines available tiers
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // "Free", "Pro", "Team"
    tier: text("tier").notNull(), // "free", "pro", "team"
    billingMode: billingModeEnum("billing_mode").notNull(),
    priceMonthly: integer("price_monthly").notNull(), // cents
    priceYearly: integer("price_yearly").notNull(), // cents
    limits: jsonb("limits").$type<PlanLimits>().notNull(),
    stripePriceIdMonthly: text("stripe_price_id_monthly"),
    stripePriceIdYearly: text("stripe_price_id_yearly"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("subscription_plans_tier_mode_unique").on(
      table.tier,
      table.billingMode,
    ),
  ],
);

// User subscriptions - tracks active subscription for each user
export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Usage records - tracks token and task usage per billing period
export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  executionId: uuid("execution_id").references(() => executions.id, {
    onDelete: "set null",
  }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: integer("estimated_cost").notNull().default(0), // cents (for managed mode cost tracking)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// P0 Feature Tables (Diff Preview, Test Execution, Rollback)
// =============================================================================

// Pending changes - stores uncommitted file changes for review
export const pendingChanges = pgTable(
  "pending_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    action: pendingChangeActionEnum("action").notNull(),
    oldContent: text("old_content"),
    newContent: text("new_content").notNull(),
    diffPatch: text("diff_patch"),
    isApproved: boolean("is_approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("pending_changes_execution_file_unique").on(
      table.executionId,
      table.filePath,
    ),
  ],
);

// Test runs - tracks test execution results
export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    command: text("command").notNull(),
    exitCode: integer("exit_code"),
    stdout: text("stdout"),
    stderr: text("stderr"),
    durationMs: integer("duration_ms"),
    status: testRunStatusEnum("status").notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [unique("test_runs_execution_unique").on(table.executionId)],
);

// Execution commits - tracks commits for rollback
export const executionCommits = pgTable(
  "execution_commits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    commitMessage: text("commit_message").notNull(),
    filesChanged: jsonb("files_changed").$type<string[]>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    isReverted: boolean("is_reverted").notNull().default(false),
    revertedAt: timestamp("reverted_at"),
    revertSha: text("revert_sha"),
  },
  (table) => [
    unique("execution_commits_execution_sha_unique").on(
      table.executionId,
      table.commitSha,
    ),
  ],
);

// =============================================================================
// Kanban Enhancement Tables (Activity Feed & Dependencies)
// =============================================================================

// Activity Events table (for enhanced activity feed)
export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  repoId: uuid("repo_id").references(() => repos.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  executionId: uuid("execution_id").references(() => executions.id, {
    onDelete: "set null",
  }),
  eventType: text("event_type").notNull(),
  eventCategory: activityEventCategoryEnum("event_category").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  metadata: jsonb("metadata").$type<ActivityEventMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Activity Summaries table (daily aggregates)
export const activitySummaries = pgTable("activity_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  repoId: uuid("repo_id").references(() => repos.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksFailed: integer("tasks_failed").default(0),
  commits: integer("commits").default(0),
  filesChanged: integer("files_changed").default(0),
  tokensUsed: integer("tokens_used").default(0),
  summaryText: text("summary_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Dependencies junction table
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedById: uuid("blocked_by_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("task_dependencies_unique").on(table.taskId, table.blockedById),
  ],
);

// =============================================================================
// A/B Testing Tables (Prompt Engineering Framework 2026-01-29)
// =============================================================================

// Experiments table - defines A/B tests
export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, active, paused, completed
  trafficAllocation: integer("traffic_allocation").notNull().default(10), // Percentage 0-100
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Experiment variants - different configurations to test
export const experimentVariants = pgTable(
  "experiment_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    weight: integer("weight").notNull().default(50), // Percentage 0-100
    config: jsonb("config").$type<ExperimentVariantConfig>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("experiment_variants_experiment_name_unique").on(
      table.experimentId,
      table.name,
    ),
  ],
);

// Variant assignments - which tasks got which variant
export const variantAssignments = pgTable(
  "variant_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => experimentVariants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    executionId: uuid("execution_id").references(() => executions.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (table) => [
    unique("variant_assignments_experiment_task_unique").on(
      table.experimentId,
      table.taskId,
    ),
  ],
);

// Experiment metrics - captured outcomes
export const experimentMetrics = pgTable("experiment_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantAssignmentId: uuid("variant_assignment_id")
    .notNull()
    .references(() => variantAssignments.id, { onDelete: "cascade" }),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  metricValue: integer("metric_value").notNull(), // Store as integers (e.g., milliseconds, counts)
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});
