/**
 * AI Execution Domain Events
 *
 * Events published by the AI Execution bounded context.
 */

import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * Execution started
 */
export interface ExecutionStartedEvent extends DomainEvent {
  eventType: "ExecutionStarted";
  aggregateType: "Execution";
  data: {
    executionId: string;
    taskId: string;
    branchName: string;
  };
}

/**
 * Iteration completed (single Ralph loop cycle)
 */
export interface IterationCompletedEvent extends DomainEvent {
  eventType: "IterationCompleted";
  aggregateType: "Execution";
  data: {
    executionId: string;
    iteration: number;
    thoughtCount: number;
    actionCount: number;
  };
}

/**
 * Files extracted from AI response
 */
export interface FilesExtractedEvent extends DomainEvent {
  eventType: "FilesExtracted";
  aggregateType: "Execution";
  data: {
    executionId: string;
    fileCount: number;
    strategy: string; // strict | fuzzy | ai-json | ai-single-file | ai-code-mapping | ai-assisted
    confidence: number; // 0-1
  };
}

/**
 * Commit created
 */
export interface CommitCreatedEvent extends DomainEvent {
  eventType: "CommitCreated";
  aggregateType: "Execution";
  data: {
    executionId: string;
    commitHash: string;
    filesChanged: number;
    message: string;
  };
}

/**
 * Stuck signal detected
 */
export interface StuckSignalDetectedEvent extends DomainEvent {
  eventType: "StuckSignalDetected";
  aggregateType: "Execution";
  data: {
    executionId: string;
    signal: string; // consecutive_errors | repeated_patterns | timeout | quality_degradation | no_progress
    severity: string; // low | medium | high | critical
    details: Record<string, unknown>;
  };
}

/**
 * Recovery started
 */
export interface RecoveryStartedEvent extends DomainEvent {
  eventType: "RecoveryStarted";
  aggregateType: "Execution";
  data: {
    executionId: string;
    tier: number; // 1-4
    strategy: string; // format_guidance | simplified_prompts | context_reset | manual_fallback
    reason: string;
  };
}

/**
 * Recovery succeeded
 */
export interface RecoverySucceededEvent extends DomainEvent {
  eventType: "RecoverySucceeded";
  aggregateType: "Execution";
  data: {
    executionId: string;
    tier: number;
    attemptsInTier: number;
  };
}

/**
 * Recovery failed
 */
export interface RecoveryFailedEvent extends DomainEvent {
  eventType: "RecoveryFailed";
  aggregateType: "Execution";
  data: {
    executionId: string;
    tier: number;
    maxTierReached: boolean;
    error: string;
  };
}

/**
 * Completion validated
 */
export interface CompletionValidatedEvent extends DomainEvent {
  eventType: "CompletionValidated";
  aggregateType: "Execution";
  data: {
    executionId: string;
    score: number; // 0-100
    passed: boolean; // score >= 80
    checks: Record<string, { passed: boolean; weight: number }>;
  };
}

/**
 * Execution completed successfully
 */
export interface ExecutionCompletedEvent extends DomainEvent {
  eventType: "ExecutionCompleted";
  aggregateType: "Execution";
  data: {
    executionId: string;
    taskId: string;
    totalIterations: number;
    totalCommits: number;
    completedAt: Date;
  };
}

/**
 * Execution failed
 */
export interface ExecutionFailedEvent extends DomainEvent {
  eventType: "ExecutionFailed";
  aggregateType: "Execution";
  data: {
    executionId: string;
    taskId: string;
    error: string;
    iteration: number;
    recoveryAttempted: boolean;
  };
}

/**
 * Skill invoked during execution
 */
export interface SkillInvokedEvent extends DomainEvent {
  eventType: "SkillInvoked";
  aggregateType: "Execution";
  data: {
    executionId: string;
    skillName: string;
    phase: string; // brainstorming | planning | executing | review
    result: string; // passed | warning | blocked
  };
}

/**
 * Skill blocked execution
 */
export interface SkillBlockedEvent extends DomainEvent {
  eventType: "SkillBlocked";
  aggregateType: "Execution";
  data: {
    executionId: string;
    skillName: string;
    reason: string;
  };
}

/**
 * Union type of all AI Execution events
 */
export type AIExecutionEvent =
  | ExecutionStartedEvent
  | IterationCompletedEvent
  | FilesExtractedEvent
  | CommitCreatedEvent
  | StuckSignalDetectedEvent
  | RecoveryStartedEvent
  | RecoverySucceededEvent
  | RecoveryFailedEvent
  | CompletionValidatedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | SkillInvokedEvent
  | SkillBlockedEvent;
