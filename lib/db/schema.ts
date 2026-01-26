import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb, varchar, unique } from "drizzle-orm/pg-core";
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
]);

export const aiProviderEnum = pgEnum("ai_provider", ["anthropic", "openai", "gemini"]);

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
  preferredAnthropicModel: text("preferred_anthropic_model").default("claude-sonnet-4-20250514"),
  preferredOpenaiModel: text("preferred_openai_model").default("gpt-4o"),
  preferredGeminiModel: text("preferred_gemini_model").default("gemini-2.5-pro"),
  preferredProvider: aiProviderEnum("preferred_provider").default("anthropic"),
  encryptedGithubToken: text("encrypted_github_token"),
  githubTokenIv: text("github_token_iv"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Repositories table
export const repos = pgTable("repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  githubRepoId: text("github_repo_id").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  cloneUrl: text("clone_url").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Prevent duplicate repos for same user via race conditions
  unique("repos_user_github_unique").on(table.userId, table.githubRepoId),
]);

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id").notNull().references(() => repos.id, { onDelete: "cascade" }),
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
  statusHistory: jsonb("status_history").$type<StatusHistoryEntry[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Executions table
export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  status: executionStatusEnum("status").notNull().default("queued"),
  iteration: integer("iteration").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  logsPath: text("logs_path"),
  commits: jsonb("commits").$type<string[]>(), // Array of commit SHAs
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Execution events for live activity feed
export const executionEvents = pgTable("execution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id").notNull().references(() => executions.id, { onDelete: "cascade" }),
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
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
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
  workerJobId: uuid("worker_job_id").notNull().references(() => workerJobs.id, { onDelete: "cascade" }),
  eventType: workerEventTypeEnum("event_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<WorkerEventMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  repos: many(repos),
}));

export const reposRelations = relations(repos, ({ one, many }) => ({
  user: one(users, {
    fields: [repos.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  repo: one(repos, {
    fields: [tasks.repoId],
    references: [repos.id],
  }),
  executions: many(executions),
  workerJobs: many(workerJobs),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  task: one(tasks, {
    fields: [executions.taskId],
    references: [tasks.id],
  }),
  events: many(executionEvents),
}));

export const executionEventsRelations = relations(executionEvents, ({ one }) => ({
  execution: one(executions, {
    fields: [executionEvents.executionId],
    references: [executions.id],
  }),
}));

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
export const processingPhases = ["brainstorming", "planning", "executing"] as const;
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
export const workerJobPhases = ["brainstorming", "planning", "executing"] as const;
export type WorkerJobPhase = (typeof workerJobPhases)[number];

export const workerJobStatuses = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type WorkerJobStatus = (typeof workerJobStatuses)[number];

export const workerEventTypes = ["thinking", "action", "file_read", "file_write", "api_call", "error", "complete"] as const;
export type WorkerEventType = (typeof workerEventTypes)[number];

export type WorkerJob = typeof workerJobs.$inferSelect;
export type NewWorkerJob = typeof workerJobs.$inferInsert;
export type WorkerEvent = typeof workerEvents.$inferSelect;
export type NewWorkerEvent = typeof workerEvents.$inferInsert;
