import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { ExecutionEventMetadata } from "@/lib/ralph/types";

// =============================================================================
// Enums
// =============================================================================

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "review",
  "done",
  "stuck",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const executionEventTypeEnum = pgEnum("execution_event_type", [
  "thinking",
  "file_read",
  "file_write",
  "command_run",
  "commit",
  "error",
  "complete",
  "stuck",
  // Setup phase events
  "setup_start",
  "repo_clone",
  "repo_update",
  "branch_create",
  "branch_checkout",
  "setup_complete",
]);

export const aiProviderEnum = pgEnum("ai_provider", [
  "anthropic",
  "openai",
  "gemini",
]);

export const processingPhaseEnum = pgEnum("processing_phase", [
  "brainstorming",
  "planning",
  "executing",
]);

export const workerJobPhaseEnum = pgEnum("worker_job_phase", [
  "brainstorming",
  "planning",
  "executing",
]);

export const workerJobStatusEnum = pgEnum("worker_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const workerEventTypeEnum = pgEnum("worker_event_type", [
  "thinking",
  "action",
  "file_read",
  "file_write",
  "api_call",
  "error",
  "complete",
]);

// =============================================================================
// Activity Feed Enums
// =============================================================================

export const activityEventCategoryEnum = pgEnum("activity_event_category", [
  "ai_action",
  "git",
  "system",
]);

// =============================================================================
// Billing Enums
// =============================================================================

export const billingModeEnum = pgEnum("billing_mode", ["byok", "managed"]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

// =============================================================================
// Core Tables
// =============================================================================

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
  // Billing fields
  billingMode: billingModeEnum("billing_mode").default("byok"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Indexing status enum
export const indexingStatusEnum = pgEnum("indexing_status", [
  "pending",
  "indexing",
  "indexed",
  "failed",
]);

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
  planContent: text("plan_content"),
  branch: text("branch"),
  autonomousMode: boolean("autonomous_mode").notNull().default(false),
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
  // Task dependency fields
  blockedByIds: jsonb("blocked_by_ids").$type<string[]>().default([]),
  autoExecuteWhenUnblocked: boolean("auto_execute_when_unblocked").default(
    false,
  ),
  dependencyPriority: integer("dependency_priority").default(0),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Execution events for live activity feed
export const executionEvents = pgTable("execution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .notNull()
    .references(() => executions.id, { onDelete: "cascade" }),
  eventType: executionEventTypeEnum("event_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<ExecutionEventMetadata>(),
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

// Worker event metadata type
export interface WorkerEventMetadata {
  model?: string;
  filePath?: string;
  command?: string;
  tokenCount?: number;
  duration?: number;
  requirementsCount?: number;
  stepsCount?: number;
  iteration?: number;
  [key: string]: unknown;
}

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

// =============================================================================
// Repository Indexing Tables
// =============================================================================

// Repository index metadata types
export interface RepoIndexTechStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  packageManager?: string;
}

export interface RepoIndexEntryPoint {
  path: string;
  type: "main" | "export" | "config" | "entry";
  description?: string;
}

export interface RepoIndexDependency {
  name: string;
  version?: string;
  type: "production" | "development" | "peer";
}

export interface RepoIndexFileEntry {
  path: string;
  type: "file" | "directory";
  extension?: string;
  size?: number;
  lastModified?: string;
}

export interface RepoIndexSymbol {
  name: string;
  type: "function" | "class" | "interface" | "type" | "variable" | "constant";
  filePath: string;
  line: number;
  exported: boolean;
  signature?: string;
}

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

// Subscription plan limits type
export interface PlanLimits {
  maxRepos: number;
  maxTasksPerMonth: number;
  maxTokensPerMonth: number;
}

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

// Pending changes action enum
export const pendingChangeActionEnum = pgEnum("pending_change_action", [
  "create",
  "modify",
  "delete",
]);

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

// Test run status enum
export const testRunStatusEnum = pgEnum("test_run_status", [
  "running",
  "passed",
  "failed",
  "timeout",
  "skipped",
]);

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

// Activity event metadata type
export interface ActivityEventMetadata {
  filePath?: string;
  command?: string;
  commitSha?: string;
  prNumber?: number;
  branchName?: string;
  agentId?: string;
  iteration?: number;
  [key: string]: unknown;
}

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
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  repos: many(repos),
  subscription: one(userSubscriptions, {
    fields: [users.id],
    references: [userSubscriptions.userId],
  }),
  usageRecords: many(usageRecords),
}));

export const reposRelations = relations(repos, ({ one, many }) => ({
  user: one(users, {
    fields: [repos.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
  index: one(repoIndex, {
    fields: [repos.id],
    references: [repoIndex.repoId],
  }),
}));

export const repoIndexRelations = relations(repoIndex, ({ one }) => ({
  repo: one(repos, {
    fields: [repoIndex.repoId],
    references: [repos.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  repo: one(repos, {
    fields: [tasks.repoId],
    references: [repos.id],
  }),
  executions: many(executions),
  workerJobs: many(workerJobs),
  // Task dependencies - tasks this task is blocked by
  dependencies: many(taskDependencies, { relationName: "taskDependencies" }),
  // Tasks that are blocked by this task
  dependents: many(taskDependencies, { relationName: "blockedByDependencies" }),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  task: one(tasks, {
    fields: [executions.taskId],
    references: [tasks.id],
  }),
  events: many(executionEvents),
  pendingChanges: many(pendingChanges),
  testRuns: many(testRuns),
  commits: many(executionCommits),
}));

export const executionEventsRelations = relations(
  executionEvents,
  ({ one }) => ({
    execution: one(executions, {
      fields: [executionEvents.executionId],
      references: [executions.id],
    }),
  }),
);

export const workerJobsRelations = relations(workerJobs, ({ one, many }) => ({
  task: one(tasks, {
    fields: [workerJobs.taskId],
    references: [tasks.id],
  }),
  events: many(workerEvents),
}));

export const workerEventsRelations = relations(workerEvents, ({ one }) => ({
  workerJob: one(workerJobs, {
    fields: [workerEvents.workerJobId],
    references: [workerJobs.id],
  }),
}));

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  ({ many }) => ({
    subscriptions: many(userSubscriptions),
  }),
);

export const userSubscriptionsRelations = relations(
  userSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userSubscriptions.userId],
      references: [users.id],
    }),
    plan: one(subscriptionPlans, {
      fields: [userSubscriptions.planId],
      references: [subscriptionPlans.id],
    }),
  }),
);

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [usageRecords.taskId],
    references: [tasks.id],
  }),
  execution: one(executions, {
    fields: [usageRecords.executionId],
    references: [executions.id],
  }),
}));

// P0 Relations
export const pendingChangesRelations = relations(pendingChanges, ({ one }) => ({
  execution: one(executions, {
    fields: [pendingChanges.executionId],
    references: [executions.id],
  }),
  task: one(tasks, {
    fields: [pendingChanges.taskId],
    references: [tasks.id],
  }),
}));

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  execution: one(executions, {
    fields: [testRuns.executionId],
    references: [executions.id],
  }),
  task: one(tasks, {
    fields: [testRuns.taskId],
    references: [tasks.id],
  }),
}));

export const executionCommitsRelations = relations(
  executionCommits,
  ({ one }) => ({
    execution: one(executions, {
      fields: [executionCommits.executionId],
      references: [executions.id],
    }),
  }),
);

// Kanban Enhancement Relations
export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  task: one(tasks, {
    fields: [activityEvents.taskId],
    references: [tasks.id],
  }),
  repo: one(repos, {
    fields: [activityEvents.repoId],
    references: [repos.id],
  }),
  user: one(users, {
    fields: [activityEvents.userId],
    references: [users.id],
  }),
  execution: one(executions, {
    fields: [activityEvents.executionId],
    references: [executions.id],
  }),
}));

export const activitySummariesRelations = relations(
  activitySummaries,
  ({ one }) => ({
    user: one(users, {
      fields: [activitySummaries.userId],
      references: [users.id],
    }),
    repo: one(repos, {
      fields: [activitySummaries.repoId],
      references: [repos.id],
    }),
  }),
);

export const taskDependenciesRelations = relations(
  taskDependencies,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskDependencies.taskId],
      references: [tasks.id],
      relationName: "taskDependencies",
    }),
    blockedBy: one(tasks, {
      fields: [taskDependencies.blockedById],
      references: [tasks.id],
      relationName: "blockedByDependencies",
    }),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

// Task status values for compatibility
export const taskStatuses = [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "review",
  "done",
  "stuck",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

// Status history entry for tracking task status changes
export type StatusHistoryEntry = {
  from: TaskStatus | null;
  to: TaskStatus;
  timestamp: string; // ISO date
  triggeredBy: "user" | "autonomous" | "worker";
  userId?: string;
};

// AI provider values
export const aiProviders = ["anthropic", "openai", "gemini"] as const;
export type AiProvider = (typeof aiProviders)[number];

// Processing phase values
export const processingPhases = [
  "brainstorming",
  "planning",
  "executing",
] as const;
export type ProcessingPhase = (typeof processingPhases)[number];

// Core types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type ExecutionEvent = typeof executionEvents.$inferSelect;
export type NewExecutionEvent = typeof executionEvents.$inferInsert;

// Worker history types
export const workerJobPhases = [
  "brainstorming",
  "planning",
  "executing",
] as const;
export type WorkerJobPhase = (typeof workerJobPhases)[number];

export const workerJobStatuses = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type WorkerJobStatus = (typeof workerJobStatuses)[number];

export const workerEventTypes = [
  "thinking",
  "action",
  "file_read",
  "file_write",
  "api_call",
  "error",
  "complete",
] as const;
export type WorkerEventType = (typeof workerEventTypes)[number];

export type WorkerJob = typeof workerJobs.$inferSelect;
export type NewWorkerJob = typeof workerJobs.$inferInsert;
export type WorkerEvent = typeof workerEvents.$inferSelect;
export type NewWorkerEvent = typeof workerEvents.$inferInsert;

// Repository indexing types
export const indexingStatuses = [
  "pending",
  "indexing",
  "indexed",
  "failed",
] as const;
export type IndexingStatus = (typeof indexingStatuses)[number];

export type RepoIndex = typeof repoIndex.$inferSelect;
export type NewRepoIndex = typeof repoIndex.$inferInsert;

// Billing types
export const billingModes = ["byok", "managed"] as const;
export type BillingMode = (typeof billingModes)[number];

export const billingCycles = ["monthly", "yearly"] as const;
export type BillingCycle = (typeof billingCycles)[number];

export const subscriptionStatuses = [
  "active",
  "canceled",
  "past_due",
  "trialing",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

// P0 Feature types
export const pendingChangeActions = ["create", "modify", "delete"] as const;
export type PendingChangeAction = (typeof pendingChangeActions)[number];

export const testRunStatuses = [
  "running",
  "passed",
  "failed",
  "timeout",
  "skipped",
] as const;
export type TestRunStatus = (typeof testRunStatuses)[number];

export type PendingChange = typeof pendingChanges.$inferSelect;
export type NewPendingChange = typeof pendingChanges.$inferInsert;
export type TestRun = typeof testRuns.$inferSelect;
export type NewTestRun = typeof testRuns.$inferInsert;
export type ExecutionCommit = typeof executionCommits.$inferSelect;
export type NewExecutionCommit = typeof executionCommits.$inferInsert;

// Kanban Enhancement types
export const activityEventCategories = ["ai_action", "git", "system"] as const;
export type ActivityEventCategory = (typeof activityEventCategories)[number];

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
export type ActivitySummary = typeof activitySummaries.$inferSelect;
export type NewActivitySummary = typeof activitySummaries.$inferInsert;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type NewTaskDependency = typeof taskDependencies.$inferInsert;
