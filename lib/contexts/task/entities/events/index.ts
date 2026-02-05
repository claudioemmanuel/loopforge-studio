import type { TaskStatus } from "../value-objects";

/**
 * Base domain event interface
 */
export interface DomainEvent {
  type: string;
  aggregateId: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

/**
 * Task lifecycle events
 */

export interface TaskCreated extends DomainEvent {
  type: "TaskCreated";
  data: {
    repoId: string;
    title: string;
  };
}

export interface TaskStatusChanged extends DomainEvent {
  type: "TaskStatusChanged";
  data: {
    oldStatus: TaskStatus;
    newStatus: TaskStatus;
  };
}

export interface BrainstormingStarted extends DomainEvent {
  type: "BrainstormingStarted";
  data: {
    workerId: string;
  };
}

export interface BrainstormingCompleted extends DomainEvent {
  type: "BrainstormingCompleted";
  data: {
    summary: string;
  };
}

export interface PlanningStarted extends DomainEvent {
  type: "PlanningStarted";
  data: {
    workerId: string;
  };
}

export interface PlanningCompleted extends DomainEvent {
  type: "PlanningCompleted";
  data: {
    planLength: number;
  };
}

export interface ExecutionStarted extends DomainEvent {
  type: "ExecutionStarted";
  data: {
    workerId: string;
  };
}

export interface ExecutionCompleted extends DomainEvent {
  type: "ExecutionCompleted";
  data: {
    commitSha?: string;
    prUrl?: string;
  };
}

export interface ExecutionFailed extends DomainEvent {
  type: "ExecutionFailed";
  data: {
    error: string;
  };
}

export interface TaskStuck extends DomainEvent {
  type: "TaskStuck";
  data: {
    reason: string;
  };
}

export interface TaskPriorityChanged extends DomainEvent {
  type: "TaskPriorityChanged";
  data: {
    oldPriority: number;
    newPriority: number;
  };
}

export interface ExecutionClaimed extends DomainEvent {
  type: "ExecutionClaimed";
  data: {
    workerId: string;
  };
}

/**
 * Union type of all task domain events
 */
export type TaskDomainEvent =
  | TaskCreated
  | TaskStatusChanged
  | BrainstormingStarted
  | BrainstormingCompleted
  | PlanningStarted
  | PlanningCompleted
  | ExecutionStarted
  | ExecutionCompleted
  | ExecutionFailed
  | TaskStuck
  | TaskPriorityChanged
  | ExecutionClaimed;
