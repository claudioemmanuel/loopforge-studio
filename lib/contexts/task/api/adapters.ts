/**
 * Task API Adapters
 *
 * Maps between domain models and API response/request formats.
 * Preserves backward compatibility with existing API contracts.
 */

import type { TaskState } from "../domain/task-aggregate";
import type {
  TaskStatus,
  TaskMetadata,
  TaskConfiguration,
  StatusHistoryEntry,
} from "../domain/types";

/**
 * API response format for task
 * Matches existing database schema and frontend expectations
 */
export interface TaskApiResponse {
  id: string;
  repoId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  brainstormSummary: string | null;
  brainstormConversation: string | null;
  brainstormMessageCount: number | null;
  brainstormCompactedAt: Date | null;
  planContent: string | null;
  branch: string | null;
  autonomousMode: boolean;
  autoApprove: boolean;
  processingPhase: string | null;
  processingJobId: string | null;
  processingStartedAt: Date | null;
  processingStatusText: string | null;
  processingProgress: number | null;
  statusHistory: StatusHistoryEntry[];
  prUrl: string | null;
  prNumber: number | null;
  prTargetBranch: string | null;
  prDraft: boolean | null;
  blockedByIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API request format for creating/updating tasks
 */
export interface TaskApiRequest {
  title?: string;
  description?: string;
  priority?: number;
  autonomousMode?: boolean;
  autoApprove?: boolean;
  prTargetBranch?: string;
  prDraft?: boolean;
}

/**
 * Task adapter - maps between domain and API formats
 */
export class TaskAdapter {
  /**
   * Convert domain state to API response format
   *
   * Flattens nested domain structure to match existing API contract.
   * Frontend expects flat structure with specific field names.
   */
  static toApiResponse(state: TaskState): TaskApiResponse {
    return {
      // Identity
      id: state.id,
      repoId: state.repositoryId,

      // Metadata fields (flattened)
      title: state.metadata.title,
      description: state.metadata.description ?? null,
      status: state.status,
      priority: state.metadata.priority,

      // Brainstorm fields
      brainstormSummary: state.brainstormResult?.summary ?? null,
      brainstormConversation: state.brainstormResult?.conversation
        ? JSON.stringify(state.brainstormResult.conversation)
        : null,
      brainstormMessageCount: state.brainstormResult?.messageCount ?? null,
      brainstormCompactedAt: state.brainstormResult?.compactedAt ?? null,

      // Plan content
      planContent: state.planContent,

      // Execution fields
      branch: state.executionResult?.branchName ?? null,
      prUrl: state.executionResult?.prUrl ?? null,
      prNumber: state.executionResult?.prNumber ?? null,

      // Configuration (flattened)
      autonomousMode: state.configuration.autonomousMode,
      autoApprove: state.configuration.autoApprove,
      prTargetBranch: state.configuration.prTargetBranch ?? null,
      prDraft: state.configuration.prDraft ?? null,

      // Processing state (flattened)
      processingPhase: state.processingState.phase,
      processingJobId: state.processingState.jobId,
      processingStartedAt: state.processingState.startedAt,
      processingStatusText: state.processingState.statusText,
      processingProgress: state.processingState.progress,

      // Dependencies and history
      blockedByIds: state.blockedByIds,
      statusHistory: state.statusHistory,

      // Timestamps
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  /**
   * Convert API request to domain metadata
   *
   * Extracts metadata fields from API request body.
   * Only updates provided fields (partial update support).
   */
  static fromApiRequest(body: TaskApiRequest): Partial<TaskMetadata> {
    const metadata: Partial<TaskMetadata> = {};

    if (body.title !== undefined) {
      metadata.title = body.title;
    }

    if (body.description !== undefined) {
      metadata.description = body.description;
    }

    if (body.priority !== undefined) {
      metadata.priority = body.priority;
    }

    return metadata;
  }

  /**
   * Convert API request to domain configuration
   *
   * Extracts configuration fields from API request body.
   * Only updates provided fields (partial update support).
   */
  static toConfiguration(body: TaskApiRequest): Partial<TaskConfiguration> {
    const configuration: Partial<TaskConfiguration> = {};

    if (body.autonomousMode !== undefined) {
      configuration.autonomousMode = body.autonomousMode;
    }

    if (body.autoApprove !== undefined) {
      configuration.autoApprove = body.autoApprove;
    }

    if (body.prTargetBranch !== undefined) {
      configuration.prTargetBranch = body.prTargetBranch;
    }

    if (body.prDraft !== undefined) {
      configuration.prDraft = body.prDraft;
    }

    return configuration;
  }
}
