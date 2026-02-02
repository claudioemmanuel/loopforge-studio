/**
 * Analytics Domain Events
 *
 * Events published by the Analytics bounded context.
 */

import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * Activity logged
 */
export interface ActivityLoggedEvent extends DomainEvent {
  eventType: "ActivityLogged";
  aggregateType: "Activity";
  data: {
    activityId: string;
    userId: string;
    taskId?: string;
    repoId?: string;
    executionId?: string;
    category: string; // ai_action | git | system | test | review
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Daily summary generated
 */
export interface DailySummaryGeneratedEvent extends DomainEvent {
  eventType: "DailySummaryGenerated";
  aggregateType: "Summary";
  data: {
    summaryId: string;
    userId: string;
    date: Date;
    tasksCompleted: number;
    tasksFailed: number;
    commits: number;
    filesChanged: number;
    tokensUsed: number;
    summaryText?: string;
  };
}

/**
 * Experiment started (A/B testing)
 */
export interface ExperimentStartedEvent extends DomainEvent {
  eventType: "ExperimentStarted";
  aggregateType: "Experiment";
  data: {
    experimentId: string;
    name: string;
    description?: string;
    variants: string[];
    startedAt: Date;
  };
}

/**
 * Variant assigned to user
 */
export interface VariantAssignedEvent extends DomainEvent {
  eventType: "VariantAssigned";
  aggregateType: "Experiment";
  data: {
    experimentId: string;
    userId: string;
    variant: string;
    assignedAt: Date;
  };
}

/**
 * Metric recorded for experiment
 */
export interface MetricRecordedEvent extends DomainEvent {
  eventType: "MetricRecorded";
  aggregateType: "Experiment";
  data: {
    experimentId: string;
    userId: string;
    variant: string;
    metricName: string;
    value: number;
    recordedAt: Date;
  };
}

/**
 * Union type of all Analytics events
 */
export type AnalyticsEvent =
  | ActivityLoggedEvent
  | DailySummaryGeneratedEvent
  | ExperimentStartedEvent
  | VariantAssignedEvent
  | MetricRecordedEvent;
