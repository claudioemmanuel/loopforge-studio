/**
 * Agent system types for multi-agent execution
 */

export type AgentCategory =
  | "core-development"
  | "language-specialist"
  | "quality-security"
  | "infrastructure"
  | "meta";

export interface Tool {
  name: string;
  description: string;
  enabled: boolean;
}

export interface AgentDefinition {
  /** Unique identifier for the agent */
  id: string;
  /** Display name */
  name: string;
  /** Short description of the agent's purpose */
  description: string;
  /** Category for grouping agents */
  category: AgentCategory;
  /** System prompt that defines the agent's behavior */
  systemPrompt: string;
  /** List of capabilities this agent has */
  capabilities: string[];
  /** Keywords used for routing tasks to this agent */
  keywords: string[];
  /** Tools this agent can use */
  tools: Tool[];
  /** Priority for routing (higher = more likely to be selected when multiple match) */
  priority: number;
}

export interface AgentExecutionContext {
  /** The task/step being executed */
  task: PlanStep;
  /** Working directory (repository path) */
  workingDir: string;
  /** Project name */
  project: string;
  /** Change/task ID */
  changeId: string;
  /** Current iteration within this agent's execution */
  iteration: number;
  /** Plan content for context */
  planContent?: string;
  /** Previous agent outputs for context chaining */
  previousOutputs?: AgentOutput[];
}

export interface AgentOutput {
  /** Agent that produced this output */
  agentId: string;
  /** The task that was executed */
  taskId: string;
  /** Output content from the agent */
  content: string;
  /** Files that were modified */
  modifiedFiles: string[];
  /** Whether the task was completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Timestamp of completion */
  timestamp: Date;
}

export interface AgentResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Agent that executed the task */
  agentId: string;
  /** Output from the agent */
  output: string;
  /** Files modified during execution */
  modifiedFiles: string[];
  /** Any error that occurred */
  error?: string;
  /** Execution metrics */
  metrics: {
    /** Time taken in milliseconds */
    durationMs: number;
    /** Number of AI calls made */
    aiCalls: number;
    /** Tokens used */
    tokensUsed?: number;
  };
}

export interface PlanStep {
  /** Unique identifier for the step */
  id: string;
  /** Step title/summary */
  title: string;
  /** Detailed description of what needs to be done */
  description: string;
  /** IDs of steps that must complete before this one */
  dependencies: string[];
  /** Estimated complexity (for parallel execution prioritization) */
  complexity?: "low" | "medium" | "high";
  /** Tags for routing (e.g., "backend", "frontend", "test") */
  tags?: string[];
}

export interface ParsedPlan {
  /** All steps in the plan */
  steps: PlanStep[];
  /** Plan title/summary */
  title?: string;
  /** Overall plan description */
  description?: string;
}

export interface ReviewResult {
  /** Whether the code passed review */
  passed: boolean;
  /** Issues found during review */
  issues: ReviewIssue[];
  /** Overall feedback */
  feedback: string;
  /** Suggested fixes (if any) */
  suggestions?: string[];
}

export interface ReviewIssue {
  /** Severity of the issue */
  severity: "critical" | "high" | "medium" | "low";
  /** Issue description */
  description: string;
  /** File path where issue was found */
  filePath?: string;
  /** Line number (if applicable) */
  lineNumber?: number;
  /** Suggestion for fixing the issue */
  suggestion?: string;
}

// Execution-related types

export interface TaskNode {
  /** Unique ID matching PlanStep.id */
  id: string;
  /** The plan step this node represents */
  step: PlanStep;
  /** IDs of prerequisite tasks */
  dependencies: string[];
  /** IDs of tasks waiting on this one */
  dependents: string[];
  /** Current execution status */
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  /** Agent assigned to execute this task */
  assignedAgent?: string;
  /** Result of execution (populated after completion) */
  result?: AgentResult;
  /** Review result (populated after code review) */
  reviewResult?: ReviewResult;
}

export interface DependencyGraph {
  /** All task nodes indexed by ID */
  nodes: Map<string, TaskNode>;
  /** List of root nodes (no dependencies) */
  roots: string[];
  /** Whether the graph has been validated (no cycles) */
  validated: boolean;
}

export interface ParallelExecutionOptions {
  /** Maximum concurrent tasks (default: 3) */
  maxConcurrency: number;
  /** Whether to retry failed tasks once */
  retryOnFailure: boolean;
  /** Stop all execution if a critical task fails */
  stopOnCriticalFailure: boolean;
  /** Mandatory code review after each task */
  mandatoryReview: boolean;
  /** Maximum retries for a single task */
  maxRetries: number;
}

export interface ExecutionProgress {
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks */
  completed: number;
  /** Number of failed tasks */
  failed: number;
  /** Number of currently running tasks */
  running: number;
  /** Number of pending tasks */
  pending: number;
  /** Currently executing task IDs */
  currentTasks: string[];
  /** Overall progress percentage */
  progressPercent: number;
}

export interface ParallelExecutionResult {
  /** Whether all tasks completed successfully */
  success: boolean;
  /** Results for each task */
  taskResults: Map<string, AgentResult>;
  /** Review results for each task */
  reviewResults: Map<string, ReviewResult>;
  /** Commits made during execution */
  commits: string[];
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  /** Any global error that stopped execution */
  error?: string;
}
