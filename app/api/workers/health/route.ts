import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { connectionOptions } from "@/lib/queue";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import { workerJobs, workerHeartbeats } from "@/lib/db/schema";
import { desc, sql, and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface WorkerHealthResponse {
  worker: {
    status: "running" | "stopped" | "error";
    uptime: number | null;
    lastHeartbeat: Date | null;
    restartCount: number;
  };
  queues: {
    brainstorm: QueueStats;
    plan: QueueStats;
    execution: QueueStats;
  };
  redis: {
    connected: boolean;
    memoryUsage: string;
    uptimeSeconds: number;
  };
  failures: {
    count: number;
    recent: Array<{
      taskId: string;
      phase: string;
      error: string;
      timestamp: Date;
    }>;
  };
  stuck: {
    count: number;
    tasks: Array<{
      taskId: string;
      title: string;
      stuckDuration: string;
    }>;
  };
}

async function getQueueStats(queueName: string): Promise<QueueStats> {
  try {
    const queue = new Queue(queueName, {
      connection: connectionOptions,
    });

    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused"
    );

    await queue.close();

    return counts as QueueStats;
  } catch (error) {
    console.error(`Error getting stats for queue ${queueName}:`, error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }
}

async function getRedisInfo() {
  try {
    const connection = new Redis(connectionOptions);

    // Ping to check connectivity
    await connection.ping();

    // Get server info
    const info = await connection.info("server");
    const memory = await connection.info("memory");

    // Parse uptime from info string
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
    const uptimeSeconds = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;

    // Parse memory usage
    const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "Unknown";

    await connection.quit();

    return {
      connected: true,
      memoryUsage,
      uptimeSeconds,
    };
  } catch (error) {
    console.error("Error getting Redis info:", error);
    return {
      connected: false,
      memoryUsage: "Unknown",
      uptimeSeconds: 0,
    };
  }
}

async function getWorkerStatus() {
  try {
    // Get most recent worker heartbeat
    const heartbeat = await db
      .select()
      .from(workerHeartbeats)
      .orderBy(desc(workerHeartbeats.timestamp))
      .limit(1)
      .execute();

    if (!heartbeat || heartbeat.length === 0) {
      return {
        status: "stopped" as const,
        uptime: null,
        lastHeartbeat: null,
        restartCount: 0,
      };
    }

    const lastHeartbeat = heartbeat[0].timestamp;
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
    const twoMinutes = 2 * 60 * 1000;

    // If heartbeat is older than 2 minutes, consider worker stopped
    if (timeSinceHeartbeat > twoMinutes) {
      return {
        status: "stopped" as const,
        uptime: null,
        lastHeartbeat,
        restartCount: 0,
      };
    }

    // Calculate uptime (time since oldest heartbeat in last hour)
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
  } catch (error) {
    console.error("Error getting worker status:", error);
    return {
      status: "error" as const,
      uptime: null,
      lastHeartbeat: null,
      restartCount: 0,
    };
  }
}

async function getRecentFailures() {
  try {
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
      .limit(10)
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
  } catch (error) {
    console.error("Error getting recent failures:", error);
    return {
      count: 0,
      recent: [],
    };
  }
}

async function getStuckTasks() {
  try {
    // Find tasks stuck in processing for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const stuckTasks = await db.execute(sql`
      SELECT
        id as "taskId",
        title,
        EXTRACT(EPOCH FROM (NOW() - processing_started_at)) / 60 as "stuckMinutes"
      FROM tasks
      WHERE processing_phase IS NOT NULL
        AND processing_started_at < ${tenMinutesAgo}
      ORDER BY processing_started_at ASC
      LIMIT 20
    `);

    const tasks = stuckTasks.rows.map((row: unknown) => {
      const r = row as { taskId: string; title: string; stuckMinutes: number };
      return {
        taskId: r.taskId,
        title: r.title,
        stuckDuration: `${Math.floor(r.stuckMinutes)} minutes`,
      };
    });

    return {
      count: tasks.length,
      tasks,
    };
  } catch (error) {
    console.error("Error getting stuck tasks:", error);
    return {
      count: 0,
      tasks: [],
    };
  }
}

export const GET = withAuth(async (request: NextRequest) => {
  try {
    // Gather all health data in parallel
    const [workerStatus, brainstormStats, planStats, executionStats, redisInfo, failures, stuck] =
      await Promise.all([
        getWorkerStatus(),
        getQueueStats("brainstorm"),
        getQueueStats("plan"),
        getQueueStats("execution"),
        getRedisInfo(),
        getRecentFailures(),
        getStuckTasks(),
      ]);

    const response: WorkerHealthResponse = {
      worker: workerStatus,
      queues: {
        brainstorm: brainstormStats,
        plan: planStats,
        execution: executionStats,
      },
      redis: redisInfo,
      failures,
      stuck,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in worker health endpoint:", error);
    return handleError(
      Errors.internal("Failed to retrieve worker health status")
    );
  }
});
