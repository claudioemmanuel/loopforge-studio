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
  DomainEvent,
  TaskCreated,
  BrainstormingStarted,
  BrainstormingCompleted,
  PlanningCompleted,
  ExecutionClaimed,
  ExecutionStarted,
  ExecutionCompleted,
  ExecutionFailed,
  TaskStuck,
  TaskStatusChanged,
  TaskFieldsUpdated,
  TaskPriorityChanged,
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
   * Save execution plan
   */
  savePlan(plan: string): [Task, PlanningCompleted] {
    const now = new Date();

    const newState: TaskState = {
      ...this.state,
      planContent: plan,
      updatedAt: now,
    };

    const event: PlanningCompleted = {
      type: "PlanningCompleted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { planLength: plan.length },
    };

    return [new Task(newState), event];
  }

  /**
   * Update task metadata fields
   */
  updateFields(fields: {
    title?: string;
    description?: string;
    priority?: number;
  }): [Task, TaskFieldsUpdated | null] {
    const now = new Date();
    const hasChanges =
      fields.title !== undefined ||
      fields.description !== undefined ||
      fields.priority !== undefined;

    if (!hasChanges) {
      return [this, null];
    }

    const newState: TaskState = {
      ...this.state,
      metadata: {
        ...this.state.metadata,
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.description !== undefined && {
          description: fields.description,
        }),
        ...(fields.priority !== undefined && { priority: fields.priority }),
      },
      updatedAt: now,
    };

    const event: TaskFieldsUpdated = {
      type: "TaskFieldsUpdated",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { fields },
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
   * Mark task as running
   */
  markAsRunning(executionId: string): [Task, ExecutionStarted] {
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

    const event: ExecutionStarted = {
      type: "ExecutionStarted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { workerId: executionId },
    };

    return [new Task(newState), event];
  }

  /**
   * Mark task as completed with execution result
   */
  markAsCompleted(result: ExecutionResult): [Task, ExecutionCompleted] {
    const now = new Date();

    const newState: TaskState = {
      ...this.state,
      status: "done",
      processingPhase: null,
      executionResult: result,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "done", timestamp: now },
      ],
      updatedAt: now,
    };

    const event: ExecutionCompleted = {
      type: "ExecutionCompleted",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        prUrl: result.prUrl,
      },
    };

    return [new Task(newState), event];
  }

  /**
   * Mark task as failed
   */
  markAsFailed(error: string): [Task, ExecutionFailed] {
    const now = new Date();

    const newState: TaskState = {
      ...this.state,
      status: "ready",
      processingPhase: null,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "ready", timestamp: now },
      ],
      updatedAt: now,
    };

    const event: ExecutionFailed = {
      type: "ExecutionFailed",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { error },
    };

    return [new Task(newState), event];
  }

  /**
   * Mark task as stuck
   */
  markAsStuck(reason: string): [Task, TaskStuck] {
    const now = new Date();

    const newState: TaskState = {
      ...this.state,
      status: "stuck",
      processingPhase: null,
      statusHistory: [
        ...this.state.statusHistory,
        { status: "stuck", timestamp: now },
      ],
      updatedAt: now,
    };

    const event: TaskStuck = {
      type: "TaskStuck",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { reason },
    };

    return [new Task(newState), event];
  }

  /**
   * Set autonomous mode
   */
  setAutonomousMode(enabled: boolean): [Task, DomainEvent | null] {
    if (this.state.configuration.autonomousMode === enabled) {
      return [this, null];
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      configuration: {
        ...this.state.configuration,
        autonomousMode: enabled,
      },
      updatedAt: now,
    };

    const event = {
      type: "TaskConfigurationUpdated" as const,
      aggregateId: this.state.id,
      occurredAt: now,
      data: { autonomousMode: enabled },
    };

    return [new Task(newState), event];
  }

  /**
   * Update priority
   */
  updatePriority(priority: number): [Task, TaskPriorityChanged | null] {
    if (this.state.metadata.priority === priority) {
      return [this, null];
    }

    const now = new Date();
    const oldPriority = this.state.metadata.priority;

    const newState: TaskState = {
      ...this.state,
      metadata: {
        ...this.state.metadata,
        priority,
      },
      updatedAt: now,
    };

    const event: TaskPriorityChanged = {
      type: "TaskPriorityChanged",
      aggregateId: this.state.id,
      occurredAt: now,
      data: { oldPriority, newPriority: priority },
    };

    return [new Task(newState), event];
  }

  /**
   * Update configuration
   */
  updateConfiguration(
    config: Partial<TaskConfiguration>,
  ): [Task, DomainEvent | null] {
    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      configuration: {
        ...this.state.configuration,
        ...config,
      },
      updatedAt: now,
    };

    const event = {
      type: "TaskConfigurationUpdated" as const,
      aggregateId: this.state.id,
      occurredAt: now,
      data: config,
    };

    return [new Task(newState), event];
  }

  /**
   * Add dependency
   */
  addDependency(dependsOnId: string): [Task, DomainEvent | null] {
    // Check if dependency already exists
    if (this.state.blockedByIds.includes(dependsOnId)) {
      return [this, null];
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      blockedByIds: [...this.state.blockedByIds, dependsOnId],
      updatedAt: now,
    };

    const event = {
      type: "TaskDependencyAdded" as const,
      aggregateId: this.state.id,
      occurredAt: now,
      data: { dependsOnId },
    };

    return [new Task(newState), event];
  }

  /**
   * Remove dependency
   */
  removeDependency(dependsOnId: string): [Task, DomainEvent | null] {
    // Check if dependency exists
    if (!this.state.blockedByIds.includes(dependsOnId)) {
      return [this, null];
    }

    const now = new Date();
    const newState: TaskState = {
      ...this.state,
      blockedByIds: this.state.blockedByIds.filter((id) => id !== dependsOnId),
      updatedAt: now,
    };

    const event = {
      type: "TaskDependencyRemoved" as const,
      aggregateId: this.state.id,
      occurredAt: now,
      data: { dependsOnId },
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
