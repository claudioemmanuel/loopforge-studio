/**
 * Task Repository - Infrastructure adapter implementing ITaskRepository
 *
 * Handles persistence and retrieval of Task aggregates.
 * Maps between domain model (Task entity) and database schema.
 */

import { db } from "@/lib/db";
import { tasks, repos } from "@/lib/db/schema/tables";
import { eq, and, inArray } from "drizzle-orm";
import type { ITaskRepository } from "../../use-cases/ports/ITaskRepository";
import {
  Task,
  type TaskState,
  type StatusHistoryEntry,
} from "../../entities/Task";
import type { TaskStatus, ProcessingPhase } from "../../entities/value-objects";
import { Result } from "@/lib/shared/Result";
import { RepositoryError } from "@/lib/shared/errors";

export class TaskRepository implements ITaskRepository {
  async save(task: Task): Promise<Result<void, RepositoryError>> {
    try {
      const state = task.getState();
      const dbRow = this.toDbRow(state);

      await db.insert(tasks).values(dbRow).onConflictDoUpdate({
        target: tasks.id,
        set: dbRow,
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new RepositoryError("Failed to save task", error));
    }
  }

  async findById(id: string): Promise<Result<Task | null, RepositoryError>> {
    try {
      const row = await db.query.tasks.findFirst({
        where: eq(tasks.id, id),
      });

      if (!row) {
        return Result.ok(null);
      }

      const task = this.toDomain(row);
      return Result.ok(task);
    } catch (error) {
      return Result.fail(new RepositoryError("Failed to find task", error));
    }
  }

  async findByRepo(repoId: string): Promise<Result<Task[], RepositoryError>> {
    try {
      const rows = await db.query.tasks.findMany({
        where: eq(tasks.repoId, repoId),
        orderBy: (t, { asc }) => [asc(t.priority), asc(t.createdAt)],
      });

      const taskList = rows.map((row) => this.toDomain(row));
      return Result.ok(taskList);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to find tasks by repo", error),
      );
    }
  }

  async findByUser(userId: string): Promise<Result<Task[], RepositoryError>> {
    try {
      const rows = await db.query.tasks.findMany({
        where: (t, { exists }) =>
          exists(
            db
              .select()
              .from(repos)
              .where(and(eq(repos.id, t.repoId), eq(repos.userId, userId))),
          ),
        orderBy: (t, { asc }) => [asc(t.priority), asc(t.createdAt)],
      });

      const taskList = rows.map((row) => this.toDomain(row));
      return Result.ok(taskList);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to find tasks by user", error),
      );
    }
  }

  async delete(id: string): Promise<Result<void, RepositoryError>> {
    try {
      await db.delete(tasks).where(eq(tasks.id, id));
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new RepositoryError("Failed to delete task", error));
    }
  }

  async deleteByRepoIds(
    repoIds: string[],
  ): Promise<Result<void, RepositoryError>> {
    try {
      await db.delete(tasks).where(inArray(tasks.repoId, repoIds));
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to delete tasks by repo IDs", error),
      );
    }
  }

  async getIdsByRepoIds(
    repoIds: string[],
  ): Promise<Result<string[], RepositoryError>> {
    try {
      const rows = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(inArray(tasks.repoId, repoIds));

      return Result.ok(rows.map((r) => r.id));
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to get task IDs by repo IDs", error),
      );
    }
  }

  async existsById(id: string): Promise<Result<boolean, RepositoryError>> {
    try {
      const row = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      return Result.ok(row.length > 0);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to check task existence", error),
      );
    }
  }

  /**
   * Map domain TaskState to database row
   */
  private toDbRow(state: TaskState): Record<string, unknown> {
    return {
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      brainstormSummary: state.brainstormResult?.summary ?? null,
      brainstormConversation: state.brainstormResult?.conversation
        ? JSON.stringify(state.brainstormResult.conversation)
        : null,
      brainstormMessageCount: state.brainstormResult?.messageCount ?? null,
      brainstormCompactedAt: state.brainstormResult?.compactedAt ?? null,
      planContent: state.planContent,
      branch: state.executionResult?.branchName ?? null,
      autonomousMode: state.configuration.autonomousMode,
      autoApprove: state.configuration.autoApprove,
      processingPhase: state.processingPhase,
      processingJobId: null,
      processingStartedAt: null,
      processingStatusText: null,
      processingProgress: null,
      statusHistory: state.statusHistory,
      prUrl: state.executionResult?.prUrl ?? null,
      prNumber: state.executionResult?.prNumber ?? null,
      prTargetBranch: state.executionResult?.prTargetBranch ?? null,
      prDraft: state.executionResult?.prDraft ?? null,
      blockedByIds: state.blockedByIds,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  /**
   * Map database row to domain TaskState
   */
  private toDomain(row: Record<string, unknown>): Task {
    const state: TaskState = {
      id: row.id as string,
      repositoryId: row.repoId as string,
      metadata: {
        title: row.title as string,
        description: (row.description as string) ?? "",
        priority: row.priority as number,
      },
      status: row.status as TaskStatus,
      processingPhase: row.processingPhase as ProcessingPhase | null,
      brainstormResult: row.brainstormSummary
        ? {
            summary: row.brainstormSummary as string,
            conversation: row.brainstormConversation
              ? JSON.parse(row.brainstormConversation as string)
              : [],
            messageCount: (row.brainstormMessageCount as number) ?? 0,
            compactedAt: row.brainstormCompactedAt as Date | null,
          }
        : null,
      planContent: row.planContent as string | null,
      executionResult: row.branch
        ? {
            branchName: row.branch as string,
            prUrl: (row.prUrl as string | null) ?? null,
            prNumber: (row.prNumber as number | null) ?? null,
            prTargetBranch: (row.prTargetBranch as string | null) ?? null,
            prDraft: (row.prDraft as boolean | null) ?? null,
          }
        : null,
      configuration: {
        autonomousMode: row.autonomousMode as boolean,
        autoApprove: row.autoApprove as boolean,
      },
      blockedByIds: (row.blockedByIds as string[]) ?? [],
      statusHistory: (row.statusHistory as StatusHistoryEntry[]) ?? [],
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };

    return Task.reconstitute(state);
  }
}
