import type {
  users,
  repos,
  tasks,
  executions,
  executionEvents,
  workerJobs,
  workerEvents,
  repoIndex,
  subscriptionPlans,
  userSubscriptions,
  usageRecords,
  pendingChanges,
  testRuns,
  executionCommits,
  activityEvents,
  activitySummaries,
  taskDependencies,
} from "./tables";

// =============================================================================
// Const Arrays & Derived Types
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

// Worker history values
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

// Repository indexing values
export const indexingStatuses = [
  "pending",
  "indexing",
  "indexed",
  "failed",
] as const;
export type IndexingStatus = (typeof indexingStatuses)[number];

// Billing values
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

// P0 Feature values
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

// Activity feed values
export const activityEventCategories = ["ai_action", "git", "system"] as const;
export type ActivityEventCategory = (typeof activityEventCategories)[number];

// =============================================================================
// Interface Types (used by table $type<> generics)
// =============================================================================

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

// Subscription plan limits type
export interface PlanLimits {
  maxRepos: number;
  maxTasksPerMonth: number;
  maxTokensPerMonth: number;
}

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

// =============================================================================
// Table-Inferred Types
// =============================================================================

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
export type WorkerJob = typeof workerJobs.$inferSelect;
export type NewWorkerJob = typeof workerJobs.$inferInsert;
export type WorkerEvent = typeof workerEvents.$inferSelect;
export type NewWorkerEvent = typeof workerEvents.$inferInsert;

// Repository indexing types
export type RepoIndex = typeof repoIndex.$inferSelect;
export type NewRepoIndex = typeof repoIndex.$inferInsert;

// Billing types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

// P0 Feature types
export type PendingChange = typeof pendingChanges.$inferSelect;
export type NewPendingChange = typeof pendingChanges.$inferInsert;
export type TestRun = typeof testRuns.$inferSelect;
export type NewTestRun = typeof testRuns.$inferInsert;
export type ExecutionCommit = typeof executionCommits.$inferSelect;
export type NewExecutionCommit = typeof executionCommits.$inferInsert;

// Kanban Enhancement types
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
export type ActivitySummary = typeof activitySummaries.$inferSelect;
export type NewActivitySummary = typeof activitySummaries.$inferInsert;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type NewTaskDependency = typeof taskDependencies.$inferInsert;
