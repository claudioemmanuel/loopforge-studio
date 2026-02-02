/**
 * Task Aggregate Root
 *
 * Manages task lifecycle, status transitions, and workflow orchestration.
 * This is the main aggregate for the Task Orchestration bounded context.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type {
  TaskStatus,
  ProcessingPhase,
  TaskMetadata,
  ProcessingState,
  BrainstormResult,
  ExecutionResult,
  TaskConfiguration,
  StatusHistoryEntry,
} from "./types";
import { isValidTransition, getProcessingPhaseForStatus } from "./types";
import type {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  BrainstormingStartedEvent,
  BrainstormingCompletedEvent,
  PlanningStartedEvent,
  PlanningCompletedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  TaskStuckEvent,
  TaskPriorityChangedEvent,
} from "./events";

/**
 * Task aggregate state
 */
export interface TaskState {
  id: string;
  repositoryId: string;
  metadata: TaskMetadata;
  status: TaskStatus;
  processingState: ProcessingState;
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
 *
 * Enforces invariants:
 * - Valid status transitions (state machine)
 * - Processing phase matches status
 * - Blocked tasks cannot execute
 * - Unique branch per task
 */
export class TaskAggregate {
  private state: TaskState;
  private eventPublisher: EventPublisher;

  constructor(state: TaskState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get task ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): TaskState {
    return { ...this.state };
  }

  /**
   * Create a new task
   */
  static async create(
    params: {
      id: string;
      repositoryId: string;
      metadata: TaskMetadata;
      configuration?: Partial<TaskConfiguration>;
    },
    redis: Redis,
  ): Promise<TaskAggregate> {
    // Create initial state
    const state: TaskState = {
      id: params.id,
      repositoryId: params.repositoryId,
      metadata: params.metadata,
      status: "todo",
      processingState: {
        phase: null,
        jobId: null,
        startedAt: null,
        statusText: null,
        progress: 0,
      },
      brainstormResult: null,
      planContent: null,
      executionResult: null,
      configuration: {
        autonomousMode: params.configuration?.autonomousMode ?? false,
        autoApprove: params.configuration?.autoApprove ?? false,
        prTargetBranch: params.configuration?.prTargetBranch,
        prDraft: params.configuration?.prDraft,
      },
      blockedByIds: [],
      statusHistory: [
        {
          status: "todo",
          timestamp: new Date(),
          reason: "Task created",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task = new TaskAggregate(state, redis);

    // Publish TaskCreated event
    const event: TaskCreatedEvent = {
      id: crypto.randomUUID(),
      eventType: "TaskCreated",
      aggregateType: "Task",
      aggregateId: state.id,
      occurredAt: new Date(),
      data: {
        taskId: state.id,
        repositoryId: state.repositoryId,
        title: state.metadata.title,
        description: state.metadata.description,
        priority: state.metadata.priority,
        autonomousMode: state.configuration.autonomousMode,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await task.eventPublisher.publish(event);

    return task;
  }

  /**
   * Transition to new status
   */
  async transitionStatus(toStatus: TaskStatus, reason?: string): Promise<void> {
    const fromStatus = this.state.status;

    // Validate transition
    if (!isValidTransition(fromStatus, toStatus)) {
      throw new Error(
        `Invalid status transition: ${fromStatus} -> ${toStatus}`,
      );
    }

    // Update state
    this.state.status = toStatus;
    this.state.statusHistory.push({
      status: toStatus,
      timestamp: new Date(),
      reason,
    });
    this.state.updatedAt = new Date();

    // Update processing phase
    const newPhase = getProcessingPhaseForStatus(toStatus);
    if (newPhase !== this.state.processingState.phase) {
      this.state.processingState.phase = newPhase;
      if (newPhase === null) {
        // Clear processing state when leaving processing phase
        this.state.processingState.jobId = null;
        this.state.processingState.startedAt = null;
        this.state.processingState.statusText = null;
        this.state.processingState.progress = 0;
      }
    }

    // Publish TaskStatusChanged event
    const event: TaskStatusChangedEvent = {
      id: crypto.randomUUID(),
      eventType: "TaskStatusChanged",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        fromStatus,
        toStatus,
        reason,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Start brainstorming phase
   */
  async startBrainstorm(jobId: string): Promise<void> {
    // Must be in todo status
    if (this.state.status !== "todo") {
      throw new Error(
        `Cannot start brainstorm: task is not in todo status (current: ${this.state.status})`,
      );
    }

    // Transition to brainstorming
    await this.transitionStatus("brainstorming", "Starting brainstorm");

    // Update processing state
    this.state.processingState.jobId = jobId;
    this.state.processingState.startedAt = new Date();
    this.state.processingState.statusText = "Brainstorming...";
    this.state.processingState.progress = 0;
    this.state.updatedAt = new Date();

    // Publish BrainstormingStarted event
    const event: BrainstormingStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "BrainstormingStarted",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        jobId,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete brainstorming phase
   */
  async completeBrainstorm(result: BrainstormResult): Promise<void> {
    if (this.state.status !== "brainstorming") {
      throw new Error(
        `Cannot complete brainstorm: task is not brainstorming (current: ${this.state.status})`,
      );
    }

    // Store brainstorm result
    this.state.brainstormResult = result;
    this.state.updatedAt = new Date();

    // Publish BrainstormingCompleted event
    const event: BrainstormingCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "BrainstormingCompleted",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        summary: result.summary,
        messageCount: result.messageCount,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // Transition to planning
    await this.transitionStatus("planning", "Brainstorm complete");
  }

  /**
   * Start planning phase
   */
  async startPlanning(jobId: string): Promise<void> {
    if (this.state.status !== "planning") {
      throw new Error(
        `Cannot start planning: task is not in planning status (current: ${this.state.status})`,
      );
    }

    // Update processing state
    this.state.processingState.jobId = jobId;
    this.state.processingState.startedAt = new Date();
    this.state.processingState.statusText = "Generating plan...";
    this.state.processingState.progress = 0;
    this.state.updatedAt = new Date();

    // Publish PlanningStarted event
    const event: PlanningStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "PlanningStarted",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        jobId,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete planning phase
   */
  async completePlanning(planContent: string): Promise<void> {
    if (this.state.status !== "planning") {
      throw new Error(
        `Cannot complete planning: task is not planning (current: ${this.state.status})`,
      );
    }

    // Store plan
    this.state.planContent = planContent;
    this.state.updatedAt = new Date();

    // Publish PlanningCompleted event
    const event: PlanningCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "PlanningCompleted",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        planLength: planContent.length,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // Transition to ready
    await this.transitionStatus("ready", "Plan complete");
  }

  /**
   * Start execution phase
   */
  async startExecution(params: {
    executionId: string;
    branchName: string;
  }): Promise<void> {
    // Must be in ready status
    if (this.state.status !== "ready") {
      throw new Error(
        `Cannot start execution: task is not ready (current: ${this.state.status})`,
      );
    }

    // Cannot execute if blocked
    if (this.isBlocked()) {
      throw new Error(
        `Cannot start execution: task is blocked by ${this.state.blockedByIds.length} dependencies`,
      );
    }

    // Transition to executing
    await this.transitionStatus("executing", "Starting execution");

    // Update processing state
    this.state.processingState.jobId = params.executionId;
    this.state.processingState.startedAt = new Date();
    this.state.processingState.statusText = "Executing...";
    this.state.processingState.progress = 0;
    this.state.updatedAt = new Date();

    // Publish ExecutionStarted event
    const event: ExecutionStartedEvent = {
      id: crypto.randomUUID(),
      eventType: "ExecutionStarted",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        executionId: params.executionId,
        branchName: params.branchName,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Complete execution phase
   */
  async completeExecution(result: ExecutionResult): Promise<void> {
    if (this.state.status !== "executing") {
      throw new Error(
        `Cannot complete execution: task is not executing (current: ${this.state.status})`,
      );
    }

    // Store execution result
    this.state.executionResult = result;
    this.state.updatedAt = new Date();

    // Publish ExecutionCompleted event
    const event: ExecutionCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "ExecutionCompleted",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        executionId: result.executionId,
        commitCount: result.commitCount,
        prUrl: result.prUrl,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // Transition to review or done
    const nextStatus = result.prUrl ? "review" : "done";
    await this.transitionStatus(nextStatus, "Execution complete");
  }

  /**
   * Fail execution phase
   */
  async failExecution(params: {
    executionId: string;
    error: string;
  }): Promise<void> {
    if (this.state.status !== "executing") {
      throw new Error(
        `Cannot fail execution: task is not executing (current: ${this.state.status})`,
      );
    }

    // Publish ExecutionFailed event
    const event: ExecutionFailedEvent = {
      id: crypto.randomUUID(),
      eventType: "ExecutionFailed",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        executionId: params.executionId,
        error: params.error,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // Transition to stuck
    await this.transitionStatus("stuck", `Execution failed: ${params.error}`);
  }

  /**
   * Mark task as stuck
   */
  async markStuck(reason: string): Promise<void> {
    const phase = this.state.processingState.phase;

    // Publish TaskStuck event
    const event: TaskStuckEvent = {
      id: crypto.randomUUID(),
      eventType: "TaskStuck",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        reason,
        phase: phase ?? undefined,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // Transition to stuck
    await this.transitionStatus("stuck", reason);
  }

  /**
   * Update priority
   */
  async updatePriority(newPriority: number): Promise<void> {
    const oldPriority = this.state.metadata.priority;

    if (oldPriority === newPriority) {
      return; // No change
    }

    this.state.metadata.priority = newPriority;
    this.state.updatedAt = new Date();

    // Publish TaskPriorityChanged event
    const event: TaskPriorityChangedEvent = {
      id: crypto.randomUUID(),
      eventType: "TaskPriorityChanged",
      aggregateType: "Task",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        taskId: this.state.id,
        fromPriority: oldPriority,
        toPriority: newPriority,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<TaskConfiguration>): void {
    this.state.configuration = {
      ...this.state.configuration,
      ...config,
    };
    this.state.updatedAt = new Date();
  }

  /**
   * Add dependency
   */
  addBlockedBy(taskId: string): void {
    if (!this.state.blockedByIds.includes(taskId)) {
      this.state.blockedByIds.push(taskId);
      this.state.updatedAt = new Date();
    }
  }

  /**
   * Remove dependency
   */
  removeBlockedBy(taskId: string): void {
    const index = this.state.blockedByIds.indexOf(taskId);
    if (index !== -1) {
      this.state.blockedByIds.splice(index, 1);
      this.state.updatedAt = new Date();
    }
  }

  /**
   * Check if task is blocked
   */
  isBlocked(): boolean {
    return this.state.blockedByIds.length > 0;
  }

  /**
   * Check if task can execute (ready and not blocked)
   */
  canExecute(): boolean {
    return this.state.status === "ready" && !this.isBlocked();
  }

  /**
   * Get status
   */
  getStatus(): TaskStatus {
    return this.state.status;
  }

  /**
   * Get processing phase
   */
  getProcessingPhase(): ProcessingPhase | null {
    return this.state.processingState.phase;
  }
}
