/**
 * Task Aggregate Root
 *
 * Pure domain entity with zero external dependencies.
 * Enforces business rules and emits domain events.
 */

import { BusinessRuleError } from "@/lib/shared/errors";
import type {
  TaskStatus,
  ProcessingPhase,
  TaskMetadata,
  TaskConfiguration,
} from "./value-objects";
import { canTransitionTo as canStatusTransitionTo } from "./value-objects";
import type {
  TaskCreated,
  BrainstormingStarted,
  BrainstormingCompleted,
  ExecutionClaimed,
  TaskStatusChanged,
} from "./events";

/**
 * Supporting types for task state
 */
export interface BrainstormResult {
  summary: string;
  conversation: BrainstormMessage[];
  messageCount: number;
  compactedAt: Date | null;
}

export interface BrainstormMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ExecutionResult {
  branchName: string;
  prUrl: string | null;
  prNumber: number | null;
  prTargetBranch: string | null;
  prDraft: boolean | null;
}

export interface StatusHistoryEntry {
  status: TaskStatus;
  timestamp: Date;
}

/**
 * Task aggregate state
 */
export interface TaskState {
  id: string;
  repositoryId: string;
  metadata: TaskMetadata;
  status: TaskStatus;
  processingPhase: ProcessingPhase | null;
  brainstormResult: BrainstormResult | null;
  planContent: string | null;
  executionResult: ExecutionResult | null;
  configuration: TaskConfiguration;
  blockedByIds: string[];
  statusHistory: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task aggregate root
 */
export class Task {
  private constructor(private readonly state: TaskState) {}

  /**
   * Create a new task
   */
  static create(params: {
    id: string;
    repoId: string;
    title: string;
    description: string;
    priority?: number;
  }): [Task, TaskCreated] {
    const now = new Date();

    const state: TaskState = {
      id: params.id,
      repositoryId: params.repoId,
      metadata: {
        title: params.title,
        description: params.description,
        priority: params.priority ?? 0,
      },
      status: "todo",
      processingPhase: null,
      brainstormResult: null,
      planContent: null,
      executionResult: null,
      configuration: {
        autonomousMode: false,
        autoApprove: false,
      },
      blockedByIds: [],
      statusHistory: [{ status: "todo", timestamp: now }],
      createdAt: now,
      updatedAt: now,
    };

    const task = new Task(state);
    const event: TaskCreated = {
      type: "TaskCreated",
      aggregateId: params.id,
      occurredAt: now,
      data: { repoId: params.repoId, title: params.title },
    };

    return [task, event];
  }

  /**
   * Reconstitute task from persisted state
   */
  static reconstitute(state: TaskState): Task {
    return new Task(state);
  }

  /**
   * Start brainstorming phase
   */
  startBrainstorming(workerId: string): [Task, BrainstormingStarted] {
    if (!this.canTransitionTo("brainstorming")) {
      throw new BusinessRuleError(
        "INVALID_TRANSITION",
        `Cannot transition from ${this.state.status} to brainstorming`,
      );
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      status: "brainstorming",
      processingPhase: "brainstorming",
      statusHistory: [
        ...this.state.statusHistory,
        { status: "brainstorming", timestamp: now },
      ],
      updatedAt: now,
    };

    const event: BrainstormingStarted = {
      type: "BrainstormingStarted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { workerId },
    };

    return [new Task(newState), event];
  }

  /**
   * Complete brainstorming with result
   */
  completeBrainstorming(
    result: BrainstormResult,
  ): [Task, BrainstormingCompleted] {
    if (this.state.status !== "brainstorming") {
      throw new BusinessRuleError(
        "INVALID_STATE",
        "Task must be in brainstorming state",
      );
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      status: "planning",
      processingPhase: null,
      brainstormResult: result,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "planning", timestamp: now },
      ],
      updatedAt: now,
    };

    const event: BrainstormingCompleted = {
      type: "BrainstormingCompleted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { summary: result.summary },
    };

    return [new Task(newState), event];
  }

  /**
   * Claim task for execution
   */
  claimForExecution(workerId: string): [Task, ExecutionClaimed] {
    // Business rule: Must have a plan
    if (!this.state.planContent) {
      throw new BusinessRuleError(
        "MISSING_PLAN",
        "Task must have a plan before execution",
      );
    }

    // Business rule: Cannot be blocked by dependencies
    if (this.state.blockedByIds.length > 0) {
      throw new BusinessRuleError(
        "BLOCKED_BY_DEPENDENCIES",
        "Task is blocked by dependencies",
      );
    }

    if (!this.canTransitionTo("executing")) {
      throw new BusinessRuleError(
        "INVALID_TRANSITION",
        `Cannot transition from ${this.state.status} to executing`,
      );
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      status: "executing",
      processingPhase: "executing",
      statusHistory: [
        ...this.state.statusHistory,
        { status: "executing", timestamp: now },
      ],
      updatedAt: now,
    };

    const event: ExecutionClaimed = {
      type: "ExecutionClaimed",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { workerId },
    };

    return [new Task(newState), event];
  }

  /**
   * Change task status
   */
  changeStatus(
    newStatus: TaskStatus,
    reason?: string,
  ): [Task, TaskStatusChanged] {
    if (!this.canTransitionTo(newStatus)) {
      throw new BusinessRuleError(
        "INVALID_TRANSITION",
        `Cannot transition from ${this.state.status} to ${newStatus}${reason ? `: ${reason}` : ""}`,
      );
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      status: newStatus,
      processingPhase:
        newStatus === "brainstorming" ||
        newStatus === "planning" ||
        newStatus === "executing"
          ? newStatus
          : null,
      statusHistory: [
        ...this.state.statusHistory,
        { status: newStatus, timestamp: now },
      ],
      updatedAt: now,
    };

    const event: TaskStatusChanged = {
      type: "TaskStatusChanged",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        oldStatus: this.state.status,
        newStatus,
      },
    };

    return [new Task(newState), event];
  }

  /**
   * Query: Can transition to a given status?
   */
  canTransitionTo(status: TaskStatus): boolean {
    return canStatusTransitionTo(this.state.status, status);
  }

  /**
   * Query: Is task blocked by dependencies?
   */
  isBlockedByDependencies(): boolean {
    return this.state.blockedByIds.length > 0;
  }

  /**
   * Get immutable state
   */
  getState(): Readonly<TaskState> {
    return this.state;
  }

  /**
   * Get task ID
   */
  get id(): string {
    return this.state.id;
  }
}
