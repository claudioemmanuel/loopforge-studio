/**
 * Pending Changes - CRUD operations for pending file changes
 * Used for diff preview in the review flow
 */

import { db } from "./index";
import {
  pendingChanges,
  type PendingChange,
  type NewPendingChange,
} from "./schema";
import { eq, and } from "drizzle-orm";

/**
 * Create a new pending change record
 */
export async function createPendingChange(
  data: NewPendingChange,
): Promise<PendingChange> {
  const [result] = await db.insert(pendingChanges).values(data).returning();
  return result;
}

/**
 * Create multiple pending changes in a single transaction
 */
export async function createPendingChanges(
  data: NewPendingChange[],
): Promise<PendingChange[]> {
  if (data.length === 0) return [];
  return await db.insert(pendingChanges).values(data).returning();
}

/**
 * Get all pending changes for an execution
 */
export async function getPendingChangesByExecution(
  executionId: string,
): Promise<PendingChange[]> {
  return await db
    .select()
    .from(pendingChanges)
    .where(eq(pendingChanges.executionId, executionId))
    .orderBy(pendingChanges.filePath);
}

/**
 * Get all pending changes for a task
 */
export async function getPendingChangesByTask(
  taskId: string,
): Promise<PendingChange[]> {
  return await db
    .select()
    .from(pendingChanges)
    .where(eq(pendingChanges.taskId, taskId))
    .orderBy(pendingChanges.filePath);
}

/**
 * Get a specific pending change by ID
 */
export async function getPendingChangeById(
  id: string,
): Promise<PendingChange | null> {
  const [result] = await db
    .select()
    .from(pendingChanges)
    .where(eq(pendingChanges.id, id))
    .limit(1);
  return result ?? null;
}

/**
 * Get a pending change by execution and file path
 */
export async function getPendingChangeByFile(
  executionId: string,
  filePath: string,
): Promise<PendingChange | null> {
  const [result] = await db
    .select()
    .from(pendingChanges)
    .where(
      and(
        eq(pendingChanges.executionId, executionId),
        eq(pendingChanges.filePath, filePath),
      ),
    )
    .limit(1);
  return result ?? null;
}

/**
 * Update a pending change
 */
export async function updatePendingChange(
  id: string,
  data: Partial<Omit<PendingChange, "id" | "createdAt">>,
): Promise<PendingChange | null> {
  const [result] = await db
    .update(pendingChanges)
    .set(data)
    .where(eq(pendingChanges.id, id))
    .returning();
  return result ?? null;
}

/**
 * Approve a pending change
 */
export async function approvePendingChange(
  id: string,
): Promise<PendingChange | null> {
  return updatePendingChange(id, { isApproved: true });
}

/**
 * Approve all pending changes for an execution
 */
export async function approveAllPendingChanges(
  executionId: string,
): Promise<number> {
  const result = await db
    .update(pendingChanges)
    .set({ isApproved: true })
    .where(eq(pendingChanges.executionId, executionId));
  return result.rowCount ?? 0;
}

/**
 * Delete a pending change
 */
export async function deletePendingChange(id: string): Promise<boolean> {
  const result = await db
    .delete(pendingChanges)
    .where(eq(pendingChanges.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete all pending changes for an execution
 */
export async function deletePendingChangesByExecution(
  executionId: string,
): Promise<number> {
  const result = await db
    .delete(pendingChanges)
    .where(eq(pendingChanges.executionId, executionId));
  return result.rowCount ?? 0;
}

/**
 * Delete all pending changes for a task
 */
export async function deletePendingChangesByTask(
  taskId: string,
): Promise<number> {
  const result = await db
    .delete(pendingChanges)
    .where(eq(pendingChanges.taskId, taskId));
  return result.rowCount ?? 0;
}

/**
 * Check if there are any unapproved changes for an execution
 */
export async function hasUnapprovedChanges(
  executionId: string,
): Promise<boolean> {
  const [result] = await db
    .select()
    .from(pendingChanges)
    .where(
      and(
        eq(pendingChanges.executionId, executionId),
        eq(pendingChanges.isApproved, false),
      ),
    )
    .limit(1);
  return !!result;
}

/**
 * Get count of pending changes for an execution
 */
export async function countPendingChanges(executionId: string): Promise<{
  total: number;
  approved: number;
  pending: number;
}> {
  const changes = await getPendingChangesByExecution(executionId);
  const approved = changes.filter((c) => c.isApproved).length;
  return {
    total: changes.length,
    approved,
    pending: changes.length - approved,
  };
}
