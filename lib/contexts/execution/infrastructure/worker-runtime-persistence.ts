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

type ExecutionInsert = typeof executions.$inferInsert;
type ExecutionUpdate = Partial<typeof executions.$inferInsert>;
type WorkerJobInsert = typeof workerJobs.$inferInsert;
type WorkerJobUpdate = Partial<typeof workerJobs.$inferInsert>;
type TaskUpdate = Partial<typeof tasks.$inferInsert>;

export async function createExecutionRecord(params: {
  taskId: string;
  status: ExecutionInsert["status"];
  iteration: number;
}): Promise<typeof executions.$inferSelect> {
  const [execution] = await db.insert(executions).values(params).returning();
  return execution;
}

export async function createWorkerJobRecord(
  params: WorkerJobInsert,
): Promise<typeof workerJobs.$inferSelect> {
  const [workerJob] = await db.insert(workerJobs).values(params).returning();
  return workerJob;
}

export async function updateExecutionRecord(
  executionId: string,
  values: ExecutionUpdate,
): Promise<void> {
  await db.update(executions).set(values).where(eq(executions.id, executionId));
}

export async function updateTaskRecord(
  taskId: string,
  values: TaskUpdate,
): Promise<void> {
  await db.update(tasks).set(values).where(eq(tasks.id, taskId));
}

export async function updateWorkerJobRecord(
  workerJobId: string,
  values: WorkerJobUpdate,
): Promise<void> {
  await db.update(workerJobs).set(values).where(eq(workerJobs.id, workerJobId));
}

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
