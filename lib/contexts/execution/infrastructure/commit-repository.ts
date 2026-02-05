/**
 * Commit Repository (Infrastructure Layer)
 * CRUD operations for commit tracking and rollback
 */

import { db } from "@/lib/db";
import {
  executionCommits,
  executions,
  type ExecutionCommit,
  type NewExecutionCommit,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Create a new execution commit record
 */
export async function createExecutionCommit(
  data: NewExecutionCommit,
): Promise<ExecutionCommit> {
  const [result] = await db.insert(executionCommits).values(data).returning();
  return result;
}

/**
 * Create multiple commit records in a single transaction
 */
export async function createExecutionCommits(
  data: NewExecutionCommit[],
): Promise<ExecutionCommit[]> {
  if (data.length === 0) return [];
  return await db.insert(executionCommits).values(data).returning();
}

/**
 * Get a commit by ID
 */
export async function getExecutionCommitById(
  id: string,
): Promise<ExecutionCommit | null> {
  const [result] = await db
    .select()
    .from(executionCommits)
    .where(eq(executionCommits.id, id))
    .limit(1);
  return result ?? null;
}

/**
 * Get a commit by execution and SHA
 */
export async function getExecutionCommitBySha(
  executionId: string,
  commitSha: string,
): Promise<ExecutionCommit | null> {
  const [result] = await db
    .select()
    .from(executionCommits)
    .where(
      and(
        eq(executionCommits.executionId, executionId),
        eq(executionCommits.commitSha, commitSha),
      ),
    )
    .limit(1);
  return result ?? null;
}

/**
 * Get all commits for an execution
 */
export async function getCommitsByExecution(
  executionId: string,
): Promise<ExecutionCommit[]> {
  return await db
    .select()
    .from(executionCommits)
    .where(eq(executionCommits.executionId, executionId))
    .orderBy(desc(executionCommits.createdAt));
}

/**
 * Get the latest commit for an execution
 */
export async function getLatestCommit(
  executionId: string,
): Promise<ExecutionCommit | null> {
  const [result] = await db
    .select()
    .from(executionCommits)
    .where(eq(executionCommits.executionId, executionId))
    .orderBy(desc(executionCommits.createdAt))
    .limit(1);
  return result ?? null;
}

/**
 * Update a commit record
 */
export async function updateExecutionCommit(
  id: string,
  data: Partial<Omit<ExecutionCommit, "id" | "createdAt">>,
): Promise<ExecutionCommit | null> {
  const [result] = await db
    .update(executionCommits)
    .set(data)
    .where(eq(executionCommits.id, id))
    .returning();
  return result ?? null;
}

/**
 * Mark a commit as reverted
 */
export async function markCommitReverted(
  id: string,
  revertSha: string,
): Promise<ExecutionCommit | null> {
  return updateExecutionCommit(id, {
    isReverted: true,
    revertedAt: new Date(),
    revertSha,
  });
}

/**
 * Mark all commits for an execution as reverted
 */
export async function markAllCommitsReverted(
  executionId: string,
  revertSha: string,
): Promise<number> {
  const result = await db
    .update(executionCommits)
    .set({
      isReverted: true,
      revertedAt: new Date(),
      revertSha,
    })
    .where(eq(executionCommits.executionId, executionId));
  return result.rowCount ?? 0;
}

/**
 * Delete a commit record
 */
export async function deleteExecutionCommit(id: string): Promise<boolean> {
  const result = await db
    .delete(executionCommits)
    .where(eq(executionCommits.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if an execution has any non-reverted commits
 */
export async function hasNonRevertedCommits(
  executionId: string,
): Promise<boolean> {
  const [result] = await db
    .select()
    .from(executionCommits)
    .where(
      and(
        eq(executionCommits.executionId, executionId),
        eq(executionCommits.isReverted, false),
      ),
    )
    .limit(1);
  return !!result;
}

/**
 * Get all commit SHAs for an execution
 */
export async function getCommitShas(executionId: string): Promise<string[]> {
  const commits = await getCommitsByExecution(executionId);
  return commits.map((c) => c.commitSha);
}

/**
 * Mark an execution as reverted
 */
export async function markExecutionReverted(
  executionId: string,
  revertCommitSha: string,
  reason?: string,
): Promise<void> {
  await db
    .update(executions)
    .set({
      reverted: true,
      revertCommitSha,
      revertedAt: new Date(),
      revertReason: reason,
    })
    .where(eq(executions.id, executionId));
}

/**
 * Check if an execution can be rolled back
 * Returns an object with canRollback and reason
 */
export async function canRollback(executionId: string): Promise<{
  canRollback: boolean;
  reason?: string;
}> {
  // Get the execution
  const [execution] = await db
    .select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1);

  if (!execution) {
    return { canRollback: false, reason: "Execution not found" };
  }

  if (execution.reverted) {
    return { canRollback: false, reason: "Execution already reverted" };
  }

  if (execution.status !== "completed") {
    return { canRollback: false, reason: "Execution not completed" };
  }

  // Check if there are any commits to revert
  const hasCommits = await hasNonRevertedCommits(executionId);
  if (!hasCommits) {
    return { canRollback: false, reason: "No commits to revert" };
  }

  return { canRollback: true };
}
