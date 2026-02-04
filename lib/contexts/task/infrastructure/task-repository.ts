/**
 * Task Repository (Infrastructure Layer)
 *
 * Handles persistence and retrieval of Task aggregates.
 * Translates between database schema and domain model.
 */

import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import { TaskAggregate, type TaskState } from "../domain/task-aggregate";
import type {
  TaskStatus,
  ProcessingPhase,
  StatusHistoryEntry,
  BrainstormMessage,
} from "../domain/types";

/**
 * Database row type for Task-related columns only
 */
type TaskRow = {
  id: string;
  repoId: string;
  title: string;
  description: string | null;
  status: string;
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
};

/**
 * Task repository for database operations
 */
export class TaskRepository {
  constructor(private redis: Redis) {}

  /**
   * Find task by ID
   */
  async findById(taskId: string): Promise<TaskAggregate | null> {
    const rows = await db
      .select({
        id: tasks.id,
        repoId: tasks.repoId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        brainstormSummary: tasks.brainstormSummary,
        brainstormConversation: tasks.brainstormConversation,
        brainstormMessageCount: tasks.brainstormMessageCount,
        brainstormCompactedAt: tasks.brainstormCompactedAt,
        planContent: tasks.planContent,
        branch: tasks.branch,
        autonomousMode: tasks.autonomousMode,
        autoApprove: tasks.autoApprove,
        processingPhase: tasks.processingPhase,
        processingJobId: tasks.processingJobId,
        processingStartedAt: tasks.processingStartedAt,
        processingStatusText: tasks.processingStatusText,
        processingProgress: tasks.processingProgress,
        statusHistory: tasks.statusHistory,
        prUrl: tasks.prUrl,
        prNumber: tasks.prNumber,
        prTargetBranch: tasks.prTargetBranch,
        prDraft: tasks.prDraft,
        blockedByIds: tasks.blockedByIds,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (rows.length === 0) {
      return null;
    }

    const state = this.mapRowToState(rows[0]);
    return new TaskAggregate(state, this.redis);
  }

  /**
   * Save task aggregate to database
   */
  async save(task: TaskAggregate): Promise<void> {
    const state = task.getState();
    const row = this.mapStateToRow(state);

    // Check if task exists
    const existing = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, state.id));

    if (existing.length === 0) {
      // Insert new task
      await db.insert(tasks).values(row);
    } else {
      // Update existing task
      await db.update(tasks).set(row).where(eq(tasks.id, state.id));
    }
  }

  /**
   * Map database row to domain state
   */
  private mapRowToState(row: TaskRow): TaskState {
    // Parse brainstorm conversation
    let conversation: BrainstormMessage[] = [];
    if (row.brainstormConversation) {
      try {
        conversation = JSON.parse(row.brainstormConversation);
      } catch (e) {
        // Invalid JSON, use empty array
        conversation = [];
      }
    }

    return {
      id: row.id,
      repositoryId: row.repoId,
      metadata: {
        title: row.title,
        description: row.description ?? undefined,
        priority: row.priority,
      },
      status: row.status as TaskStatus,
      processingState: {
        phase: row.processingPhase as ProcessingPhase | null,
        jobId: row.processingJobId,
        startedAt: row.processingStartedAt,
        statusText: row.processingStatusText,
        progress: row.processingProgress ?? 0,
      },
      brainstormResult: row.brainstormSummary
        ? {
            summary: row.brainstormSummary,
            conversation,
            messageCount: row.brainstormMessageCount ?? 0,
            compactedAt: row.brainstormCompactedAt ?? undefined,
          }
        : null,
      planContent: row.planContent,
      executionResult:
        row.branch || row.prUrl
          ? {
              executionId: "", // Not stored in tasks table
              branchName: row.branch ?? "",
              commitCount: 0, // Not stored in tasks table
              prUrl: row.prUrl ?? undefined,
              prNumber: row.prNumber ?? undefined,
            }
          : null,
      configuration: {
        autonomousMode: row.autonomousMode,
        autoApprove: row.autoApprove,
        prTargetBranch: row.prTargetBranch ?? undefined,
        prDraft: row.prDraft ?? undefined,
      },
      blockedByIds: row.blockedByIds,
      statusHistory: row.statusHistory,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain state to database row
   */
  private mapStateToRow(state: TaskState): Record<string, unknown> {
    // Serialize brainstorm conversation
    let conversationJson: string | null = null;
    if (state.brainstormResult?.conversation) {
      conversationJson = JSON.stringify(state.brainstormResult.conversation);
    }

    return {
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description ?? null,
      status: state.status,
      priority: state.metadata.priority,
      brainstormSummary: state.brainstormResult?.summary ?? null,
      brainstormConversation: conversationJson,
      brainstormMessageCount: state.brainstormResult?.messageCount ?? null,
      brainstormCompactedAt: state.brainstormResult?.compactedAt ?? null,
      planContent: state.planContent,
      branch: state.executionResult?.branchName ?? null,
      autonomousMode: state.configuration.autonomousMode,
      autoApprove: state.configuration.autoApprove,
      processingPhase: state.processingState.phase,
      processingJobId: state.processingState.jobId,
      processingStartedAt: state.processingState.startedAt,
      processingStatusText: state.processingState.statusText,
      processingProgress: state.processingState.progress,
      statusHistory: state.statusHistory,
      prUrl: state.executionResult?.prUrl ?? null,
      prNumber: state.executionResult?.prNumber ?? null,
      prTargetBranch: state.configuration.prTargetBranch ?? null,
      prDraft: state.configuration.prDraft ?? null,
      blockedByIds: state.blockedByIds,
      updatedAt: state.updatedAt,
    };
  }
}
