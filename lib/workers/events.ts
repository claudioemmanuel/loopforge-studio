import Redis from "ioredis";
import { connectionOptions } from "@/lib/queue/connection";
import type { TaskStatus } from "@/lib/db/schema";

export interface WorkerEventData {
  taskId: string;
  taskTitle: string;
  repoName: string;
  status: TaskStatus;
  progress: number;
  currentStep?: string;
  currentAction?: string;
  error?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface WorkerEvent {
  type: "worker_update" | "worker_complete" | "worker_stuck";
  data: WorkerEventData;
  timestamp: string;
}

let publisherClient: Redis | null = null;

/**
 * Get or create a Redis client for publishing events
 */
function getPublisher(): Redis {
  if (!publisherClient) {
    publisherClient = new Redis({
      host: connectionOptions.host,
      port: connectionOptions.port,
      password: connectionOptions.password,
      username: connectionOptions.username,
    });
  }
  return publisherClient;
}

/**
 * Publish a worker event to Redis for SSE streaming
 */
export async function publishWorkerEvent(
  userId: string,
  event: WorkerEvent
): Promise<void> {
  try {
    const redis = getPublisher();
    const channel = `worker-events:${userId}`;
    await redis.publish(channel, JSON.stringify(event));
    console.log(`[worker-events] Published ${event.type} for task ${event.data.taskId}`);
  } catch (error) {
    console.error("[worker-events] Failed to publish event:", error);
  }
}

/**
 * Calculate progress percentage based on task status
 */
export function calculateProgressFromStatus(
  status: TaskStatus,
  currentStep?: string
): number {
  const progressMap: Record<TaskStatus, number> = {
    todo: 0,
    brainstorming: 20,
    planning: 40,
    ready: 60,
    executing: 80,
    done: 100,
    stuck: 0,
  };

  if (status === "executing" && currentStep) {
    // Parse "Step 3/6" to get more granular progress
    const match = currentStep.match(/Step (\d+)\/(\d+)/);
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      return 60 + (current / total) * 40;
    }
  }

  return progressMap[status] ?? 0;
}

/**
 * Create a worker update event
 */
export function createWorkerUpdateEvent(
  taskId: string,
  taskTitle: string,
  repoName: string,
  status: TaskStatus,
  options: {
    currentStep?: string;
    currentAction?: string;
    error?: string;
    completedAt?: Date;
  } = {}
): WorkerEvent {
  const eventType =
    status === "done" ? "worker_complete" :
    status === "stuck" ? "worker_stuck" :
    "worker_update";

  return {
    type: eventType,
    data: {
      taskId,
      taskTitle,
      repoName,
      status,
      progress: calculateProgressFromStatus(status, options.currentStep),
      currentStep: options.currentStep,
      currentAction: options.currentAction,
      error: options.error,
      completedAt: options.completedAt?.toISOString(),
      updatedAt: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clean up Redis connection
 */
export async function closePublisher(): Promise<void> {
  if (publisherClient) {
    await publisherClient.quit();
    publisherClient = null;
  }
}
