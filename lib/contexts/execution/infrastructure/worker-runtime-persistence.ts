import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  tasks,
  executions,
  executionEvents,
  repos,
  repoIndex,
  workerJobs,
  workerEvents,
  taskDependencies,
  activityEvents,
} from "@/lib/db/schema/tables";
import { buildStatusHistoryAppend } from "@/lib/db/status-history";
import type { WorkerEventMetadata } from "@/lib/db/schema";

export {
  db,
  users,
  tasks,
  executions,
  repos,
  repoIndex,
  workerJobs,
  taskDependencies,
  activityEvents,
  buildStatusHistoryAppend,
  eq,
  sql,
};

export async function insertExecutionEvent(params: {
  id?: string;
  executionId: string;
  eventType: string;
  content: string;
  metadata?: unknown;
  createdAt?: Date;
}): Promise<void> {
  await db.insert(executionEvents).values({
    id: params.id ?? crypto.randomUUID(),
    executionId: params.executionId,
    eventType:
      params.eventType as typeof executionEvents.$inferInsert.eventType,
    content: params.content,
    metadata: params.metadata ?? null,
    createdAt: params.createdAt ?? new Date(),
  });
}

export async function insertWorkerEvent(params: {
  workerJobId: string;
  eventType: string;
  content: string;
  metadata?: WorkerEventMetadata;
}): Promise<void> {
  await db.insert(workerEvents).values({
    workerJobId: params.workerJobId,
    eventType: params.eventType as typeof workerEvents.$inferInsert.eventType,
    content: params.content,
    metadata: params.metadata,
  });
}
