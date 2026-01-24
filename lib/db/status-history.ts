import { db } from "./index";
import { tasks } from "./schema";
import { eq, sql } from "drizzle-orm";
import type { TaskStatus, StatusHistoryEntry } from "./schema";

/**
 * Atomically updates a task's status and records the change in status history.
 * Uses PostgreSQL JSONB concatenation for atomic append to avoid race conditions.
 */
export async function updateTaskStatusWithHistory(
  params: {
    taskId: string;
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus;
    triggeredBy: "user" | "autonomous" | "worker";
    userId?: string;
  },
  additionalUpdates?: Record<string, unknown>
) {
  const historyEntry: StatusHistoryEntry = {
    from: params.fromStatus,
    to: params.toStatus,
    timestamp: new Date().toISOString(),
    triggeredBy: params.triggeredBy,
    ...(params.userId && { userId: params.userId }),
  };

  return db.update(tasks)
    .set({
      status: params.toStatus,
      statusHistory: sql`COALESCE(${tasks.statusHistory}, '[]'::jsonb) || ${JSON.stringify([historyEntry])}::jsonb`,
      updatedAt: new Date(),
      ...additionalUpdates,
    })
    .where(eq(tasks.id, params.taskId))
    .returning();
}

/**
 * Builds a SQL fragment for appending a status history entry.
 * Use this when you need to include status history in a custom update query.
 */
export function buildStatusHistoryAppend(
  params: {
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus;
    triggeredBy: "user" | "autonomous" | "worker";
    userId?: string;
  }
) {
  const historyEntry: StatusHistoryEntry = {
    from: params.fromStatus,
    to: params.toStatus,
    timestamp: new Date().toISOString(),
    triggeredBy: params.triggeredBy,
    ...(params.userId && { userId: params.userId }),
  };

  return sql`COALESCE(${tasks.statusHistory}, '[]'::jsonb) || ${JSON.stringify([historyEntry])}::jsonb`;
}
