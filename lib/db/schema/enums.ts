import { pgEnum } from "drizzle-orm/pg-core";

// =============================================================================
// Core Enums
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
// Indexing Enums
// =============================================================================

export const indexingStatusEnum = pgEnum("indexing_status", [
  "pending",
  "indexing",
  "indexed",
  "failed",
]);

// =============================================================================
// P0 Feature Enums
// =============================================================================

export const pendingChangeActionEnum = pgEnum("pending_change_action", [
  "create",
  "modify",
  "delete",
]);

export const testRunStatusEnum = pgEnum("test_run_status", [
  "running",
  "passed",
  "failed",
  "timeout",
  "skipped",
]);
