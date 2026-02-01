/**
 * Skills Type Definitions
 *
 * Defines the core types for the Loopforge skills system, which integrates
 * the Superpowers skills framework for methodological discipline and workflow guidance.
 */

import type { AIClient } from "@/lib/ai/client";

/**
 * Skill enforcement type determines how the skill affects workflow progression
 */
export type SkillEnforcement = "blocking" | "warning" | "guidance";

/**
 * Skill category for organization and filtering
 */
export type SkillCategory =
  | "quality-discipline" // TDD, verification
  | "debugging" // Systematic debugging
  | "planning" // Brainstorming, writing plans
  | "execution" // Autonomous code generation, git workflow
  | "coordination" // Multi-agent coordination
  | "optimization" // Context accumulation, prompt engineering
  | "meta"; // Using superpowers

/**
 * Task processing phase in the Kanban workflow
 */
export type TaskPhase =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "review"
  | "done"
  | "stuck";

/**
 * Skill execution status
 */
export type SkillStatus = "passed" | "warning" | "blocked";

/**
 * Context provided to a skill when invoked
 */
export interface SkillInvocationContext {
  /** Current task ID */
  taskId: string;

  /** Current phase in the workflow */
  phase: TaskPhase;

  /** Task description */
  taskDescription: string;

  /** Working directory for the repository */
  workingDir: string;

  /** Execution ID (if in executing phase) */
  executionId?: string;

  /** Files modified in current execution */
  modifiedFiles?: string[];

  /** Commits made in current execution */
  commits?: string[];

  /** Plan content (if in planning/executing phase) */
  planContent?: string;

  /** Brainstorm conversation history (if in brainstorming phase) */
  brainstormHistory?: Array<{ role: string; content: string }>;

  /** Previous skill executions for this task */
  previousSkillExecutions?: SkillExecution[];

  /** Current iteration number (if in executing phase) */
  iteration?: number;

  /** Stuck signals (if stuck detected) */
  stuckSignals?: Array<{
    type: string;
    severity: string;
    confidence: number;
    evidence: string;
    metadata?: Record<string, unknown>;
  }>;

  /** Test execution history */
  testHistory?: Array<{
    status: "passed" | "failed";
    timestamp: Date;
    output?: string;
  }>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by a skill after execution
 */
export interface SkillResult {
  /** Skill ID that produced this result */
  skillId: string;

  /** Execution status */
  status: SkillStatus;

  /** Human-readable message explaining the result */
  message: string;

  /** Augmented system prompt (for guidance skills) */
  augmentedPrompt?: string;

  /** Recommendations for addressing warnings or blocks */
  recommendations?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Timestamp of execution */
  timestamp: Date;
}

/**
 * Skill execution record (stored in database)
 */
export interface SkillExecution {
  /** Skill ID */
  skillId: string;

  /** Execution status */
  status: SkillStatus;

  /** Result message */
  message: string;

  /** ISO timestamp */
  timestamp: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Skill execute logic function signature
 */
export type SkillExecuteLogic = (
  context: SkillInvocationContext,
  client: AIClient,
) => Promise<SkillResult>;

/**
 * Complete skill definition
 */
export interface SkillDefinition {
  /** Unique skill identifier (kebab-case) */
  id: string;

  /** Human-readable name */
  name: string;

  /** Brief description of what the skill does */
  description: string;

  /** Skill category for organization */
  category: SkillCategory;

  /** Enforcement type */
  enforcement: SkillEnforcement;

  /** Phases where this skill should be automatically invoked */
  triggerPhases: TaskPhase[];

  /** System prompt content (augments AI prompts during invocation) */
  systemPrompt: string;

  /** Execution logic function */
  executeLogic: SkillExecuteLogic;

  /** Optional version identifier */
  version?: string;

  /** Optional author/source attribution */
  author?: string;
}

/**
 * Skill invocation options
 */
export interface SkillInvocationOptions {
  /** Skip execution if skill recently passed for this context */
  cacheResults?: boolean;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Force execution even if not in trigger phase */
  forceExecution?: boolean;

  /** Additional context to merge */
  additionalContext?: Partial<SkillInvocationContext>;
}

/**
 * Skill registry entry
 */
export interface SkillRegistryEntry {
  /** Skill definition */
  skill: SkillDefinition;

  /** Whether skill is enabled */
  enabled: boolean;

  /** Feature flag for this skill (if any) */
  featureFlag?: string;
}
