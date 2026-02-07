import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { executions, executionEvents } from "@/lib/db/schema/tables";
import { eq, inArray } from "drizzle-orm";
import {
  getPendingChangesByTask as getPendingChangesByTaskHelper,
  countPendingChanges as countPendingChangesHelper,
  deletePendingChangesByTask as deletePendingChangesByTaskHelper,
} from "./pending-changes-repository";
import {
  createExecutionCommit as createExecutionCommitHelper,
  getCommitsByExecution as getCommitsByExecutionHelper,
  markAllCommitsReverted,
  markExecutionReverted,
  canRollback as canRollbackHelper,
} from "./commit-repository";
import {
  getLatestTestRun,
  getTestRunSummary,
  deleteTestRunsByExecution as deleteTestRunsByExecutionHelper,
} from "./test-run-repository";

type PendingChange = Awaited<
  ReturnType<typeof getPendingChangesByTaskHelper>
>[number];
type ExecutionCommit = Awaited<
  ReturnType<typeof getCommitsByExecutionHelper>
>[number];
type TestRun = NonNullable<Awaited<ReturnType<typeof getLatestTestRun>>>;

export class ExecutionPersistenceAdapter {
  protected _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  /** Get the latest execution for a task. */
  async getLatestForTask(taskId: string) {
    return db.query.executions.findFirst({
      where: eq(executions.taskId, taskId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  /** Get all executions for a task. */
  async listByTask(taskId: string) {
    return db.query.executions.findMany({
      where: eq(executions.taskId, taskId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
  }

  /** Get a single execution by ID. */
  async getById(executionId: string) {
    const row = await db.query.executions.findFirst({
      where: eq(executions.id, executionId),
    });
    return row ?? null;
  }

  /** Get execution with task→repo chain (for ownership verification). */
  async getExecutionWithOwnership(executionId: string) {
    return db.query.executions.findFirst({
      where: eq(executions.id, executionId),
      with: {
        task: {
          with: {
            repo: true,
          },
        },
      },
    });
  }

  /** Get all events for an execution, ordered chronologically. */
  async getExecutionEvents(executionId: string) {
    const rows = await db.query.executionEvents.findMany({
      where: eq(executionEvents.executionId, executionId),
      orderBy: (e, { asc }) => [asc(e.createdAt)],
    });
    // Return full database records to match ExecutionEvent schema type
    return rows;
  }

  /** Create an execution record. */
  async create(params: {
    id: string;
    taskId: string;
    status?: string;
  }): Promise<string> {
    await db.insert(executions).values({
      id: params.id,
      taskId: params.taskId,
      status: (params.status ??
        "queued") as typeof executions.$inferInsert.status,
      iteration: 0,
      createdAt: new Date(),
    });
    return params.id;
  }

  /** Mark execution as running. */
  async markRunning(executionId: string): Promise<void> {
    await db
      .update(executions)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(executions.id, executionId));
  }

  /** Mark execution as completed with optional PR info. */
  async markCompleted(params: {
    executionId: string;
    commits?: string[];
    prUrl?: string;
    prNumber?: number;
  }): Promise<void> {
    const updates: Partial<typeof executions.$inferInsert> = {
      status: "completed",
      completedAt: new Date(),
    };
    if (params.commits) updates.commits = params.commits;
    if (params.prUrl !== undefined) updates.prUrl = params.prUrl;
    if (params.prNumber !== undefined) updates.prNumber = params.prNumber;

    await db
      .update(executions)
      .set(updates)
      .where(eq(executions.id, params.executionId));
  }

  /** Mark execution as failed. */
  async markFailed(executionId: string, errorMessage: string): Promise<void> {
    await db
      .update(executions)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
  }

  /** Mark execution as stuck. */
  async markStuck(executionId: string, signals?: unknown[]): Promise<void> {
    const updates: Partial<typeof executions.$inferInsert> = {
      status: "failed",
      completedAt: new Date(),
      errorMessage: "Execution stuck - manual intervention required",
    };
    if (signals) updates.stuckSignals = signals;

    await db
      .update(executions)
      .set(updates)
      .where(eq(executions.id, executionId));
  }

  /** Delete all executions for the given tasks (account cleanup). */
  async deleteByTaskIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await db.delete(executions).where(inArray(executions.taskId, taskIds));
  }

  /** Delete a single execution row by ID (queue race rollback helper). */
  async deleteById(executionId: string): Promise<void> {
    await db.delete(executions).where(eq(executions.id, executionId));
  }

  /**
   * Create an execution in queued status (replaces legacy ExecutionAggregate.createQueued).
   * Inserts a minimal row – the worker will update it when it starts running.
   */
  async createQueued(params: { id: string; taskId: string }): Promise<string> {
    await db.insert(executions).values({
      id: params.id,
      taskId: params.taskId,
      status: "queued" as typeof executions.$inferInsert.status,
      iteration: 0,
      createdAt: new Date(),
    });
    return params.id;
  }

  /** Generic partial update for execution rows. */
  async updateFields(
    executionId: string,
    fields: Partial<typeof executions.$inferInsert>,
  ): Promise<void> {
    await db
      .update(executions)
      .set(fields)
      .where(eq(executions.id, executionId));
  }

  /** Get all pending changes for a task. */
  async getPendingChanges(taskId: string): Promise<PendingChange[]> {
    return getPendingChangesByTaskHelper(taskId);
  }

  /** Get summary counts of pending changes for an execution. */
  async getPendingChangesSummary(
    executionId: string,
  ): Promise<{ total: number; approved: number; pending: number }> {
    return countPendingChangesHelper(executionId);
  }

  /** Delete all pending changes for a task. */
  async deletePendingChanges(taskId: string): Promise<number> {
    return deletePendingChangesByTaskHelper(taskId);
  }

  /** Record a commit for an execution. */
  async recordCommit(data: {
    executionId: string;
    commitSha: string;
    commitMessage: string;
    filesChanged: string[];
  }): Promise<ExecutionCommit> {
    return createExecutionCommitHelper({
      executionId: data.executionId,
      commitSha: data.commitSha,
      commitMessage: data.commitMessage,
      filesChanged: data.filesChanged,
      isReverted: false,
      createdAt: new Date(),
    });
  }

  /** Get all commits for an execution. */
  async getCommits(executionId: string): Promise<ExecutionCommit[]> {
    return getCommitsByExecutionHelper(executionId);
  }

  /**
   * Rollback all commits for an execution (atomic operation).
   * Marks all commits as reverted and updates execution record.
   */
  async rollbackCommits(params: {
    executionId: string;
    revertCommitSha: string;
    reason?: string;
  }): Promise<void> {
    await db.transaction(async () => {
      await markAllCommitsReverted(params.executionId, params.revertCommitSha);
      await markExecutionReverted(
        params.executionId,
        params.revertCommitSha,
        params.reason,
      );
    });
  }

  /** Check if an execution can be rolled back. */
  async canRollback(
    executionId: string,
  ): Promise<{ canRollback: boolean; reason?: string }> {
    return canRollbackHelper(executionId);
  }

  /** Get the latest test run for an execution with summary. */
  async getTestRunForExecution(executionId: string): Promise<
    | (TestRun & {
        statusText: string;
        durationText: string;
        hasOutput: boolean;
      })
    | null
  > {
    const execution = await this.getById(executionId);
    if (!execution) return null;

    const testRun = await getLatestTestRun(execution.taskId);
    if (!testRun) return null;

    const summary = getTestRunSummary(testRun);
    return {
      ...testRun,
      ...summary,
    };
  }

  /** Delete all test runs for an execution. */
  async deleteTestRunsForExecution(executionId: string): Promise<number> {
    return deleteTestRunsByExecutionHelper(executionId);
  }
}
