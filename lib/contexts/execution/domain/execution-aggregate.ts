/**
 * Execution Aggregate Root
 *
 * Manages Ralph loop execution lifecycle, iteration tracking, and recovery.
 * This is the main aggregate for the AI Execution bounded context.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type {
  ExecutionStatus,
  ExecutionConfiguration,
  Iteration,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
  ExtractionResult,
} from "./types";
import { DEFAULT_EXECUTION_CONFIG } from "./types";
import type {
  ExecutionStartedEvent,
  IterationCompletedEvent,
  FilesExtractedEvent,
  CommitCreatedEvent,
  StuckSignalDetectedEvent,
  RecoveryStartedEvent,
  RecoverySucceededEvent,
  RecoveryFailedEvent,
  CompletionValidatedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  SkillInvokedEvent,
  SkillBlockedEvent,
} from "./events";

/**
 * Execution aggregate state
 */
export interface ExecutionState {
  id: string;
  taskId: string;
  status: ExecutionStatus;
  branchName: string;
  configuration: ExecutionConfiguration;
  currentIteration: number;
  iterations: Iteration[];
  commits: CommitInfo[];
  stuckSignals: StuckSignal[];
  recoveryAttempts: RecoveryAttempt[];
  validationReport: ValidationReport | null;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

/**
 * Execution aggregate root
 *
 * Enforces invariants:
 * - Valid status transitions
 * - Max iterations not exceeded
 * - Recovery tiers escalate properly
 * - Commits tracked accurately
 */
export class ExecutionAggregate {
  private state: ExecutionState;
  private eventPublisher: EventPublisher;

  constructor(state: ExecutionState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get execution ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): ExecutionState {
    return { ...this.state };
  }

  /**
   * Start a new execution
   */
  static async start(
    params: {
      id: string;
      taskId: string;
      branchName: string;
      configuration?: Partial<ExecutionConfiguration>;
    },
    redis: Redis,
  ): Promise<ExecutionAggregate> {
    // Create initial state
    const state: ExecutionState = {
      id: params.id,
      taskId: params.taskId,
      status: "queued",
      branchName: params.branchName,
      configuration: {
        ...DEFAULT_EXECUTION_CONFIG,
        ...params.configuration,
      },
      currentIteration: 0,
      iterations: [],
      commits: [],
      stuckSignals: [],
      recoveryAttempts: [],
      validationReport: null,
      startedAt: new Date(),
      completedAt: null,
      error: null,
    };

    const execution = new ExecutionAggregate(state, redis);

    // Transition to running
    execution.state.status = "running";

    // Publish ExecutionStarted event
    const event: ExecutionStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "ExecutionStarted",
      aggregateType: "Execution",
      aggregateId: state.id,
      occurredAt: new Date(),
      data: {
        executionId: state.id,
        taskId: state.taskId,
        branchName: state.branchName,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await execution.eventPublisher.publish(event);

    return execution;
  }

  /**
   * Start new iteration
   */
  startIteration(): void {
    if (this.state.status !== "running") {
      throw new Error(
        `Cannot start iteration: execution is not running (status: ${this.state.status})`,
      );
    }

    if (this.state.currentIteration >= this.state.configuration.maxIterations) {
      throw new Error(
        `Cannot start iteration: max iterations (${this.state.configuration.maxIterations}) reached`,
      );
    }

    this.state.currentIteration += 1;
    this.state.iterations.push({
      number: this.state.currentIteration,
      startedAt: new Date(),
      thoughts: [],
      actions: [],
      filesExtracted: 0,
    });
  }

  /**
   * Complete current iteration
   */
  async completeIteration(params: {
    thoughts: string[];
    actions: string[];
  }): Promise<void> {
    let currentIter = this.getCurrentIteration();

    // Auto-start iteration if none exists
    if (!currentIter) {
      this.startIteration();
      currentIter = this.getCurrentIteration();
    }

    if (!currentIter) {
      throw new Error("Failed to start iteration");
    }

    currentIter.completedAt = new Date();
    currentIter.thoughts = params.thoughts;
    currentIter.actions = params.actions;

    // Publish IterationCompleted event
    const event: IterationCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "IterationCompleted",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        iteration: currentIter.number,
        thoughtCount: params.thoughts.length,
        actionCount: params.actions.length,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Record file extraction
   */
  async recordExtraction(result: ExtractionResult): Promise<void> {
    const currentIter = this.getCurrentIteration();
    if (currentIter) {
      currentIter.filesExtracted = result.files.length;
    }

    // Publish FilesExtracted event
    const event: FilesExtractedEvent = {
      id: crypto.randomUUID(),
      eventType: "FilesExtracted",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        fileCount: result.files.length,
        strategy: result.strategy,
        confidence: result.confidence,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Record commit
   */
  async recordCommit(commit: CommitInfo): Promise<void> {
    this.state.commits.push(commit);

    // Publish CommitCreated event
    const event: CommitCreatedEvent = {
      id: crypto.randomUUID(),
      eventType: "CommitCreated",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        commitHash: commit.hash,
        filesChanged: commit.filesChanged,
        message: commit.message,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Detect stuck signal
   */
  async detectStuckSignal(signal: StuckSignal): Promise<void> {
    this.state.stuckSignals.push(signal);

    // Publish StuckSignalDetected event
    const event: StuckSignalDetectedEvent = {
      id: crypto.randomUUID(),
      eventType: "StuckSignalDetected",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        signal: signal.type,
        severity: signal.severity,
        details: signal.details,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Start recovery attempt
   */
  async startRecovery(attempt: RecoveryAttempt, reason: string): Promise<void> {
    this.state.recoveryAttempts.push(attempt);

    // Publish RecoveryStarted event
    const event: RecoveryStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "RecoveryStarted",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        tier: attempt.tier,
        strategy: attempt.strategy,
        reason,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete recovery attempt
   */
  async completeRecovery(succeeded: boolean, error?: string): Promise<void> {
    const lastAttempt =
      this.state.recoveryAttempts[this.state.recoveryAttempts.length - 1];
    if (!lastAttempt) {
      throw new Error("No recovery attempt in progress");
    }

    lastAttempt.completedAt = new Date();
    lastAttempt.succeeded = succeeded;
    lastAttempt.error = error;

    if (succeeded) {
      // Publish RecoverySucceeded event
      const attemptsInTier = this.state.recoveryAttempts.filter(
        (a) => a.tier === lastAttempt.tier,
      ).length;

      const event: RecoverySucceededEvent = {
        id: crypto.randomUUID(),
        eventType: "RecoverySucceeded",
        aggregateType: "Execution",
        aggregateId: this.state.id,
        occurredAt: new Date(),
        data: {
          executionId: this.state.id,
          tier: lastAttempt.tier,
          attemptsInTier,
        },
        metadata: {
          correlationId: crypto.randomUUID(),
        },
      };

      await this.eventPublisher.publish(event);
    } else {
      // Publish RecoveryFailed event
      const maxTierReached = lastAttempt.tier === 4;

      const event: RecoveryFailedEvent = {
        id: crypto.randomUUID(),
        eventType: "RecoveryFailed",
        aggregateType: "Execution",
        aggregateId: this.state.id,
        occurredAt: new Date(),
        data: {
          executionId: this.state.id,
          tier: lastAttempt.tier,
          maxTierReached,
          error: error || "Unknown error",
        },
        metadata: {
          correlationId: crypto.randomUUID(),
        },
      };

      await this.eventPublisher.publish(event);
    }
  }

  /**
   * Validate completion
   */
  async validateCompletion(report: ValidationReport): Promise<void> {
    this.state.validationReport = report;

    // Publish CompletionValidated event
    const event: CompletionValidatedEvent = {
      id: crypto.randomUUID(),
      eventType: "CompletionValidated",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        score: report.score,
        passed: report.passed,
        checks: Object.fromEntries(
          Object.entries(report.checks).map(([key, value]) => [
            key,
            { passed: value.passed, weight: value.weight },
          ]),
        ),
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Record skill invocation
   */
  async recordSkill(params: {
    skillName: string;
    phase: string;
    result: "passed" | "warning" | "blocked";
  }): Promise<void> {
    // Publish SkillInvoked event
    const event: SkillInvokedEvent = {
      id: crypto.randomUUID(),
      eventType: "SkillInvoked",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        skillName: params.skillName,
        phase: params.phase,
        result: params.result,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // If blocked, publish SkillBlocked event
    if (params.result === "blocked") {
      const blockedEvent: SkillBlockedEvent = {
        id: crypto.randomUUID(),
        eventType: "SkillBlocked",
        aggregateType: "Execution",
        aggregateId: this.state.id,
        occurredAt: new Date(),
        data: {
          executionId: this.state.id,
          skillName: params.skillName,
          reason: "Skill validation failed",
        },
        metadata: {
          correlationId: crypto.randomUUID(),
        },
      };

      await this.eventPublisher.publish(blockedEvent);
    }
  }

  /**
   * Complete execution successfully
   */
  async complete(): Promise<void> {
    if (this.state.status !== "running") {
      throw new Error(
        `Cannot complete: execution is not running (status: ${this.state.status})`,
      );
    }

    this.state.status = "completed";
    this.state.completedAt = new Date();

    // Publish ExecutionCompleted event
    const event: ExecutionCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "ExecutionCompleted",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        taskId: this.state.taskId,
        totalIterations: this.state.iterations.length,
        totalCommits: this.state.commits.length,
        completedAt: this.state.completedAt,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Fail execution
   */
  async fail(error: string): Promise<void> {
    this.state.status = "failed";
    this.state.completedAt = new Date();
    this.state.error = error;

    // Publish ExecutionFailed event
    const event: ExecutionFailedEvent = {
      id: crypto.randomUUID(),
      eventType: "ExecutionFailed",
      aggregateType: "Execution",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        executionId: this.state.id,
        taskId: this.state.taskId,
        error,
        iteration: this.state.currentIteration,
        recoveryAttempted: this.state.recoveryAttempts.length > 0,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Get current iteration
   */
  private getCurrentIteration(): Iteration | undefined {
    return this.state.iterations[this.state.iterations.length - 1];
  }

  /**
   * Get status
   */
  getStatus(): ExecutionStatus {
    return this.state.status;
  }

  /**
   * Check if execution is complete
   */
  isComplete(): boolean {
    return this.state.status === "completed" || this.state.status === "failed";
  }

  /**
   * Get commit count
   */
  getCommitCount(): number {
    return this.state.commits.length;
  }
}
