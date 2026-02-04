/**
 * Task Orchestration Domain Events
 *
 * Events published by the Task Orchestration bounded context.
 */

import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * Task created by user
 */
export interface TaskCreatedEvent extends DomainEvent {
  eventType: "TaskCreated";
  aggregateType: "Task";
  data: {
    taskId: string;
    repositoryId: string;
    title: string;
    description?: string;
    priority: number;
    autonomousMode: boolean;
  };
}

/**
 * Task status changed
 */
export interface TaskStatusChangedEvent extends DomainEvent {
  eventType: "TaskStatusChanged";
  aggregateType: "Task";
  data: {
    taskId: string;
    fromStatus: string;
    toStatus: string;
    reason?: string;
  };
}

/**
 * Brainstorming phase started
 */
export interface BrainstormingStartedEvent extends DomainEvent {
  eventType: "BrainstormingStarted";
  aggregateType: "Task";
  data: {
    taskId: string;
    jobId: string;
  };
}

/**
 * Brainstorming phase completed
 */
export interface BrainstormingCompletedEvent extends DomainEvent {
  eventType: "BrainstormingCompleted";
  aggregateType: "Task";
  data: {
    taskId: string;
    summary: string;
    messageCount: number;
  };
}

/**
 * Planning phase started
 */
export interface PlanningStartedEvent extends DomainEvent {
  eventType: "PlanningStarted";
  aggregateType: "Task";
  data: {
    taskId: string;
    jobId: string;
  };
}

/**
 * Planning phase completed
 */
export interface PlanningCompletedEvent extends DomainEvent {
  eventType: "PlanningCompleted";
  aggregateType: "Task";
  data: {
    taskId: string;
    planLength: number;
  };
}

/**
 * Execution phase started
 */
export interface ExecutionStartedEvent extends DomainEvent {
  eventType: "ExecutionStarted";
  aggregateType: "Task";
  data: {
    taskId: string;
    executionId: string;
    branchName: string;
  };
}

/**
 * Execution phase completed
 */
export interface ExecutionCompletedEvent extends DomainEvent {
  eventType: "ExecutionCompleted";
  aggregateType: "Task";
  data: {
    taskId: string;
    executionId: string;
    commitCount: number;
    prUrl?: string;
  };
}

/**
 * Execution phase failed
 */
export interface ExecutionFailedEvent extends DomainEvent {
  eventType: "ExecutionFailed";
  aggregateType: "Task";
  data: {
    taskId: string;
    executionId: string;
    error: string;
  };
}

/**
 * Task marked as stuck
 */
export interface TaskStuckEvent extends DomainEvent {
  eventType: "TaskStuck";
  aggregateType: "Task";
  data: {
    taskId: string;
    reason: string;
    phase?: string;
  };
}

/**
 * Task unblocked (dependencies resolved)
 */
export interface TaskUnblockedEvent extends DomainEvent {
  eventType: "TaskUnblocked";
  aggregateType: "Task";
  data: {
    taskId: string;
    resolvedDependencies: string[];
  };
}

/**
 * Task dependency added
 */
export interface DependencyAddedEvent extends DomainEvent {
  eventType: "DependencyAdded";
  aggregateType: "Task";
  data: {
    taskId: string;
    blockedById: string;
  };
}

/**
 * Task dependency removed
 */
export interface DependencyRemovedEvent extends DomainEvent {
  eventType: "DependencyRemoved";
  aggregateType: "Task";
  data: {
    taskId: string;
    blockedById: string;
  };
}

/**
 * Task priority changed
 */
export interface TaskPriorityChangedEvent extends DomainEvent {
  eventType: "TaskPriorityChanged";
  aggregateType: "Task";
  data: {
    taskId: string;
    fromPriority: number;
    toPriority: number;
  };
}

/**
 * Union type of all Task Orchestration events
 */
export type TaskOrchestrationEvent =
  | TaskCreatedEvent
  | TaskStatusChangedEvent
  | BrainstormingStartedEvent
  | BrainstormingCompletedEvent
  | PlanningStartedEvent
  | PlanningCompletedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | TaskStuckEvent
  | TaskUnblockedEvent
  | DependencyAddedEvent
  | DependencyRemovedEvent
  | TaskPriorityChangedEvent;
