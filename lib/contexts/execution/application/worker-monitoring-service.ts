/**
 * Worker Monitoring Service (Application Layer)
 *
 * Encapsulates worker operational read/write models used by worker APIs.
 */

import type { Redis } from "ioredis";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  workerEvents,
  workerHeartbeats,
  workerJobs,
} from "@/lib/db/schema/tables";
import type { WorkerJobPhase, WorkerJobStatus } from "@/lib/db/schema";

export interface WorkerHistoryFilters {
  taskIds: string[];
  phase?: WorkerJobPhase | "all" | null;
  status?: "completed" | "failed" | "all" | null;
  repoTaskIds?: string[];
  searchTaskIds?: string[];
  limit: number;
  offset: number;
}

export class WorkerMonitoringService {
  constructor(redis: Redis) {
    void redis;
  }

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

  async getWorkerStatus() {
    const latest = await db
      .select()
      .from(workerHeartbeats)
      .orderBy(desc(workerHeartbeats.timestamp))
      .limit(1)
      .execute();

    if (!latest || latest.length === 0) {
      return {
        status: "stopped" as const,
        uptime: null,
        lastHeartbeat: null,
        restartCount: 0,
      };
    }

    const lastHeartbeat = latest[0].timestamp;
    const now = new Date();
    const twoMinutes = 2 * 60 * 1000;

    if (now.getTime() - lastHeartbeat.getTime() > twoMinutes) {
      return {
        status: "stopped" as const,
        uptime: null,
        lastHeartbeat,
        restartCount: 0,
      };
    }

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oldestRecent = await db
      .select()
      .from(workerHeartbeats)
      .where(sql`${workerHeartbeats.timestamp} > ${oneHourAgo}`)
      .orderBy(workerHeartbeats.timestamp)
      .limit(1)
      .execute();

    const uptime = oldestRecent[0]
      ? now.getTime() - oldestRecent[0].timestamp.getTime()
      : null;

    return {
      status: "running" as const,
      uptime,
      lastHeartbeat,
      restartCount: 0,
    };
  }

  async getRecentFailures(limit = 10) {
    const failures = await db
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

    return {
      count: failures.length,
      recent: failures
        .filter((f) => f.error && f.timestamp)
        .map((f) => ({
          taskId: f.taskId,
          phase: f.phase,
          error: f.error || "Unknown error",
          timestamp: f.timestamp!,
        })),
    };
  }

  async getStuckTasks(thresholdMinutes = 10, limit = 20) {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const stuckRows = await db.execute(sql`
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

    const taskRows = stuckRows.rows.map((row: unknown) => {
      const r = row as { taskId: string; title: string; stuckMinutes: number };
      return {
        taskId: r.taskId,
        title: r.title,
        stuckDuration: `${Math.floor(r.stuckMinutes)} minutes`,
      };
    });

    return {
      count: taskRows.length,
      tasks: taskRows,
    };
  }

  private buildHistoryConditions(filters: {
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

    return conditions;
  }

  async getHistory(filters: WorkerHistoryFilters) {
    const conditions = this.buildHistoryConditions(filters);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workerJobs)
      .where(and(...conditions));

    const totalCount = Number(countResult[0]?.count || 0);

    const jobs = await db.query.workerJobs.findMany({
      where: and(...conditions),
      orderBy: [desc(workerJobs.completedAt), desc(workerJobs.createdAt)],
      limit: filters.limit,
      offset: filters.offset,
      with: {
        events: {
          limit: 10,
          orderBy: [asc(workerEvents.createdAt)],
        },
      },
    });

    return {
      jobs,
      totalCount,
    };
  }

  async getHistoryStats(params: {
    taskIds: string[];
    repoTaskIds?: string[];
    searchTaskIds?: string[];
  }) {
    const conditions = this.buildHistoryConditions({
      taskIds: params.taskIds,
      status: "all",
      phase: "all",
      repoTaskIds: params.repoTaskIds,
      searchTaskIds: params.searchTaskIds,
    });

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
      .where(and(...conditions));

    return {
      total: Number(statsRows[0]?.total || 0),
      completed: Number(statsRows[0]?.completed || 0),
      failed: Number(statsRows[0]?.failed || 0),
      brainstorming: Number(statsRows[0]?.brainstorming || 0),
      planning: Number(statsRows[0]?.planning || 0),
      executing: Number(statsRows[0]?.executing || 0),
    };
  }
}
