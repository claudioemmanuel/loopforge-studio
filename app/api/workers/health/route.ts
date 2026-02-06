import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { connectionOptions } from "@/lib/queue";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getWorkerMonitoringService } from "@/lib/contexts/execution/api";

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
      "paused",
    );

    await queue.close();

    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
      paused: counts.paused,
    };
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
    const workerMonitoringService = getWorkerMonitoringService();
    return workerMonitoringService.getWorkerStatus();
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
    const workerMonitoringService = getWorkerMonitoringService();
    return workerMonitoringService.getRecentFailures(10);
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
    const workerMonitoringService = getWorkerMonitoringService();
    return workerMonitoringService.getStuckTasks(10, 20);
  } catch (error) {
    console.error("Error getting stuck tasks:", error);
    return {
      count: 0,
      tasks: [],
    };
  }
}

export const GET = withAuth(async () => {
  try {
    // Gather all health data in parallel
    const [
      workerStatus,
      brainstormStats,
      planStats,
      executionStats,
      redisInfo,
      failures,
      stuck,
    ] = await Promise.all([
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
    return handleError(Errors.serverError(error));
  }
});
