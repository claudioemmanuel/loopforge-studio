/**
 * Task Orchestration Domain Types
 *
 * Value objects and types for the Task Orchestration context.
 */

/**
 * Task status (Kanban columns)
 */
export type TaskStatus =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "review"
  | "done"
  | "stuck";

/**
 * Processing phase (active workflow stage)
 */
export type ProcessingPhase =
  | "brainstorming"
  | "planning"
  | "executing"
  | "recovering";

/**
 * Task priority
 */
export type TaskPriority = number; // Higher = more urgent

/**
 * Status history entry
 */
export interface StatusHistoryEntry {
  status: TaskStatus;
  timestamp: Date;
  reason?: string;
}

/**
 * Brainstorm conversation message
 */
export interface BrainstormMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/**
 * Task metadata
 */
export interface TaskMetadata {
  title: string;
  description?: string;
  priority: TaskPriority;
}

/**
 * Processing state (for async operations)
 */
export interface ProcessingState {
  phase: ProcessingPhase | null;
  jobId: string | null;
  startedAt: Date | null;
  statusText: string | null;
  progress: number; // 0-100
}

/**
 * Brainstorm result
 */
export interface BrainstormResult {
  summary: string;
  conversation: BrainstormMessage[];
  messageCount: number;
  compactedAt?: Date;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  executionId: string;
  branchName: string;
  commitCount: number;
  prUrl?: string;
  prNumber?: number;
}

/**
 * Task configuration
 */
export interface TaskConfiguration {
  autonomousMode: boolean;
  autoApprove: boolean;
  prTargetBranch?: string;
  prDraft?: boolean;
}

/**
 * Valid status transitions (state machine)
 */
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["brainstorming", "stuck"],
  brainstorming: ["planning", "todo", "stuck"],
  planning: ["ready", "brainstorming", "stuck"],
  ready: ["executing", "planning", "stuck"],
  executing: ["review", "done", "stuck"],
  review: ["done", "executing", "stuck"],
  done: [], // Terminal state
  stuck: ["todo", "brainstorming", "planning", "ready", "executing"], // Can recover to any previous state
};

/**
 * Check if status transition is valid
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get processing phase for status
 */
export function getProcessingPhaseForStatus(
  status: TaskStatus,
): ProcessingPhase | null {
  switch (status) {
    case "brainstorming":
      return "brainstorming";
    case "planning":
      return "planning";
    case "executing":
      return "executing";
    default:
      return null;
  }
}
