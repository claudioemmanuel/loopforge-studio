import type { TaskStatus } from "../value-objects";
import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * Task lifecycle events
 */

export interface TaskCreated extends DomainEvent<{
  repoId: string;
  title: string;
}> {
  eventType: "TaskCreated";
  aggregateType: "Task";
}

export interface TaskStatusChanged extends DomainEvent<{
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
}> {
  eventType: "TaskStatusChanged";
  aggregateType: "Task";
}

export interface TaskFieldsUpdated extends DomainEvent<{
  fields: {
    title?: string;
    description?: string;
    priority?: number;
  };
}> {
  eventType: "TaskFieldsUpdated";
  aggregateType: "Task";
}

export interface BrainstormingStarted extends DomainEvent<{
  workerId: string;
}> {
  eventType: "BrainstormingStarted";
  aggregateType: "Task";
}

export interface BrainstormingCompleted extends DomainEvent<{
  summary: string;
}> {
  eventType: "BrainstormingCompleted";
  aggregateType: "Task";
}

export interface PlanningStarted extends DomainEvent<{
  workerId: string;
}> {
  eventType: "PlanningStarted";
  aggregateType: "Task";
}

export interface PlanningCompleted extends DomainEvent<{
  planLength: number;
}> {
  eventType: "PlanningCompleted";
  aggregateType: "Task";
}

export interface ExecutionStarted extends DomainEvent<{
  workerId: string;
}> {
  eventType: "ExecutionStarted";
  aggregateType: "Task";
}

export interface ExecutionCompleted extends DomainEvent<{
  commitSha?: string;
  prUrl?: string;
}> {
  eventType: "ExecutionCompleted";
  aggregateType: "Task";
}

export interface ExecutionFailed extends DomainEvent<{
  error: string;
}> {
  eventType: "ExecutionFailed";
  aggregateType: "Task";
}

export interface TaskStuck extends DomainEvent<{
  reason: string;
}> {
  eventType: "TaskStuck";
  aggregateType: "Task";
}

export interface TaskPriorityChanged extends DomainEvent<{
  oldPriority: number;
  newPriority: number;
}> {
  eventType: "TaskPriorityChanged";
  aggregateType: "Task";
}

export interface ExecutionClaimed extends DomainEvent<{
  workerId: string;
}> {
  eventType: "ExecutionClaimed";
  aggregateType: "Task";
}

/**
 * Union type of all task domain events
 */
export type TaskDomainEvent =
  | TaskCreated
  | TaskStatusChanged
  | TaskFieldsUpdated
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
