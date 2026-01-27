export interface ProjectConfig {
  name: string;
  workingDir: string;
  tasksPath: string;
  quickVerify: string;
  fullVerify: string;
  constraints: {
    do: string[];
    dont: string[];
  };
}

export interface Session {
  project: string;
  changeId: string;
  startTime: Date;
  iteration: number;
  stuckCount: number;
  status: "running" | "complete" | "stuck" | "cancelled" | "max_iterations";
}

/** Metadata for execution events based on event type */
export interface ExecutionEventMetadata {
  /** Current iteration number */
  iteration?: number;
  /** Truncated output from iteration (for 'thinking' events) */
  output?: string;
  /** File path involved (for 'file_read' or 'file_write' events) */
  filePath?: string;
  /** Command that was run (for 'command_run' events) */
  command?: string;
  /** Exit code from command (for 'command_run' events) */
  exitCode?: number;
  /** Commit SHA (for 'commit' events) */
  commitSha?: string;
  /** Error details (for 'error' events) */
  errorDetails?: string;
  /** Agent ID (for multi-agent execution) */
  agentId?: string;
  /** Task ID (for multi-agent execution) */
  taskId?: string;
  /** Routing confidence (for multi-agent execution) */
  routingConfidence?: number;
  /** Review status (for multi-agent execution) */
  reviewPassed?: boolean;
  /** Progress percentage */
  progressPercent?: number;
  /** Original event type (when mapped to db-compatible type) */
  originalEventType?: string;
  /** Execution phase (setup or execution) */
  phase?: "setup" | "execution" | "review_prep";
  /** Repository name */
  repo?: string;
  /** Branch name */
  branch?: string;
  /** Whether branch was created */
  branchCreated?: boolean;
  /** Model used */
  model?: string;
  /** Number of files changed (for 'commit' events) */
  filesChanged?: number;
  /** PR number (for PR creation events) */
  prNumber?: number;
  /** PR URL (for PR creation events) */
  prUrl?: string;
  /** Length of output text (for diagnostic events) */
  outputLength?: number;
  /** Current attempt number (for retry loop) */
  attempt?: number;
  /** File paths involved (for multi-file events) */
  files?: string[];
  /** Number of files (for summary events) */
  fileCount?: number;
  /** Extraction method used */
  method?: string;
  /** Warning messages */
  warnings?: string[];
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Last extraction method attempted */
  lastMethod?: string;
  /** Error message */
  error?: string;
  /** Number of commits made */
  commits?: number;
  /** Original status before verification */
  originalStatus?: string;
  /** Number of files written */
  filesWritten?: number;
  /** Number of pending changes for review */
  pendingChangesCount?: number;
  /** Test command executed */
  testCommand?: string;
  /** Status of test execution */
  testStatus?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

export interface ExecutionEvent {
  type:
    | "thinking"
    | "file_read"
    | "file_write"
    | "command_run"
    | "commit"
    | "error"
    | "complete"
    | "stuck"
    | "agent_start"
    | "agent_complete"
    | "review_start"
    | "review_complete"
    | "task_start"
    | "task_complete"
    | "task_failed";
  content: string;
  metadata?: ExecutionEventMetadata;
  timestamp: Date;
}

export type CompletionStatus = "complete" | "stuck" | "continue";

export interface LoopResult {
  status: CompletionStatus;
  iterations: number;
  commits: string[];
  error?: string;
}

export const RALPH_COMPLETE = "RALPH_COMPLETE";
export const RALPH_STUCK = "RALPH_STUCK";
