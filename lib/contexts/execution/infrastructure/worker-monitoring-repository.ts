/**
 * Worker Monitoring Repository (Infrastructure Layer)
 *
 * Data access layer for worker monitoring operations.
 * Isolates database queries from application logic.
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  workerEvents,
  workerHeartbeats,
  workerJobs,
} from "@/lib/db/schema/tables";
import type { WorkerJobPhase, WorkerJobStatus } from "@/lib/db/schema";

export class WorkerMonitoringRepository {
  async recordHeartbeat(params: {
    workerId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(workerHeartbeats).values({
      workerId: params.workerId,
      timestamp: new Date(),
      metadata: params.metadata,
    });
  }

  async getLatestHeartbeat() {
    return db.query.workerHeartbeats.findFirst({
      orderBy: (heartbeats, { desc }) => [desc(heartbeats.timestamp)],
    });
  }

  async getHeartbeatsSince(since: Date) {
    return db
      .select()
      .from(workerHeartbeats)
      .where(sql`${workerHeartbeats.timestamp} > ${since}`)
      .orderBy(workerHeartbeats.timestamp)
      .limit(1)
      .execute();
  }

  async getRecentHeartbeats(limit: number) {
    return db
      .select()
      .from(workerHeartbeats)
      .orderBy(desc(workerHeartbeats.timestamp))
      .limit(limit)
      .execute();
  }

  async getRecentFailures(limit: number) {
    return db
      .select({
        taskId: workerJobs.taskId,
        phase: workerJobs.phase,
        error: workerJobs.errorMessage,
        timestamp: workerJobs.completedAt,
      })
      .from(workerJobs)
      .where(eq(workerJobs.status, "failed"))
      .orderBy(desc(workerJobs.completedAt))
      .limit(limit)
      .execute();
  }

  async getStuckTasks(threshold: Date, limit: number) {
    return db.execute(sql`
      SELECT
        id as "taskId",
        title,
        EXTRACT(EPOCH FROM (NOW() - processing_started_at)) / 60 as "stuckMinutes"
      FROM tasks
      WHERE processing_phase IS NOT NULL
        AND processing_started_at < ${threshold}
      ORDER BY processing_started_at ASC
      LIMIT ${limit}
    `);
  }

  async getJobHistory(params: {
    conditions: ReturnType<typeof and>;
    limit: number;
    offset: number;
  }) {
    const jobs = await db.query.workerJobs.findMany({
      where: params.conditions,
      orderBy: [desc(workerJobs.completedAt), desc(workerJobs.createdAt)],
      limit: params.limit,
      offset: params.offset,
      with: {
        events: {
          limit: 10,
          orderBy: [asc(workerEvents.createdAt)],
        },
      },
    });

    return jobs;
  }

  async getJobCount(conditions: ReturnType<typeof and>) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workerJobs)
      .where(conditions);

    return Number(result[0]?.count || 0);
  }

  async getJobStats(conditions: ReturnType<typeof and>) {
    const statsRows = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${workerJobs.status} = 'completed')`,
        failed: sql<number>`count(*) filter (where ${workerJobs.status} = 'failed')`,
        brainstorming: sql<number>`count(*) filter (where ${workerJobs.phase} = 'brainstorming')`,
        planning: sql<number>`count(*) filter (where ${workerJobs.phase} = 'planning')`,
        executing: sql<number>`count(*) filter (where ${workerJobs.phase} = 'executing')`,
      })
      .from(workerJobs)
      .where(conditions);

    return statsRows[0];
  }

  buildHistoryConditions(filters: {
    taskIds: string[];
    phase?: WorkerJobPhase | "all" | null;
    status?: "completed" | "failed" | "all" | null;
    repoTaskIds?: string[];
    searchTaskIds?: string[];
  }) {
    const conditions = [
      inArray(workerJobs.taskId, filters.taskIds),
      inArray(workerJobs.status, ["completed", "failed"] as WorkerJobStatus[]),
    ];

    if (filters.phase && filters.phase !== "all") {
      conditions.push(eq(workerJobs.phase, filters.phase));
    }

    if (filters.status === "completed") {
      conditions.push(eq(workerJobs.status, "completed"));
    } else if (filters.status === "failed") {
      conditions.push(eq(workerJobs.status, "failed"));
    }

    if (filters.repoTaskIds && filters.repoTaskIds.length > 0) {
      conditions.push(inArray(workerJobs.taskId, filters.repoTaskIds));
    }

    if (filters.searchTaskIds && filters.searchTaskIds.length > 0) {
      conditions.push(inArray(workerJobs.taskId, filters.searchTaskIds));
    }

    return and(...conditions);
  }
}
