import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { connectionOptions } from "@/lib/queue/connection";
import { db } from "@/lib/db";
import { tasks, type TaskStatus, type ProcessingPhase } from "@/lib/db/schema";
import { workerLogger } from "@/lib/logger";

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
  autonomousMode?: boolean;
}

export interface WorkerEvent {
  type: "worker_update" | "worker_complete" | "worker_stuck";
  data: WorkerEventData;
  timestamp: string;
}

// Processing event types for async card operations
export interface ProcessingEventData {
  taskId: string;
  taskTitle: string;
  repoName: string;
  processingPhase: ProcessingPhase;
  statusText: string;
  progress: number; // 0-100
  jobId: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface ProcessingEvent {
  type:
    | "processing_start"
    | "processing_update"
    | "processing_complete"
    | "processing_error";
  data: ProcessingEventData;
  timestamp: string;
}

// Status messages for each processing phase
export const phaseStatusMessages: Record<ProcessingPhase, string[]> = {
  brainstorming: [
    "Analyzing task...",
    "Generating ideas...",
    "Identifying considerations...",
    "Finalizing brainstorm...",
  ],
  planning: [
    "Reviewing brainstorm...",
    "Designing plan...",
    "Breaking into steps...",
    "Finalizing plan...",
  ],
  executing: [
    "Starting execution...",
    "Running tasks...",
    "Verifying changes...",
    "Completing execution...",
  ],
};

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
  event: WorkerEvent,
): Promise<void> {
  try {
    const redis = getPublisher();
    const channel = `worker-events:${userId}`;
    await redis.publish(channel, JSON.stringify(event));
    workerLogger.debug(
      { eventType: event.type, taskId: event.data.taskId },
      "Published worker event",
    );
  } catch (error) {
    workerLogger.error({ error }, "Failed to publish worker event");
  }
}

/**
 * Calculate progress percentage based on task status
 */
export function calculateProgressFromStatus(
  status: TaskStatus,
  currentStep?: string,
): number {
  const progressMap: Record<TaskStatus, number> = {
    todo: 0,
    brainstorming: 15,
    planning: 30,
    ready: 45,
    executing: 60,
    review: 85,
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
  } = {},
): WorkerEvent {
  const eventType =
    status === "done"
      ? "worker_complete"
      : status === "stuck"
        ? "worker_stuck"
        : "worker_update";

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

/**
 * Create a processing event for async card operations
 */
export function createProcessingEvent(
  type: ProcessingEvent["type"],
  taskId: string,
  taskTitle: string,
  repoName: string,
  processingPhase: ProcessingPhase,
  jobId: string,
  startedAt: Date,
  options: {
    statusText?: string;
    progress?: number;
    error?: string;
  } = {},
): ProcessingEvent {
  // Determine progress based on type if not provided
  let progress = options.progress ?? 0;
  if (type === "processing_complete") {
    progress = 100;
  } else if (type === "processing_error") {
    progress = progress; // Keep current progress
  }

  // Use default status text based on phase if not provided
  const statusText =
    options.statusText ?? phaseStatusMessages[processingPhase][0];

  return {
    type,
    data: {
      taskId,
      taskTitle,
      repoName,
      processingPhase,
      statusText,
      progress,
      jobId,
      startedAt: startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      error: options.error,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Publish a processing event to Redis for SSE streaming
 * Also persists progress to database for recovery on refresh
 */
export async function publishProcessingEvent(
  userId: string,
  event: ProcessingEvent,
): Promise<void> {
  try {
    // Persist progress to database for recovery on page refresh
    await db
      .update(tasks)
      .set({
        processingProgress: event.data.progress,
        processingStatusText: event.data.statusText,
      })
      .where(eq(tasks.id, event.data.taskId));

    // Publish to Redis for real-time updates
    const redis = getPublisher();
    const channel = `worker-events:${userId}`;
    await redis.publish(channel, JSON.stringify(event));
    workerLogger.debug(
      {
        eventType: event.type,
        taskId: event.data.taskId,
        phase: event.data.processingPhase,
      },
      "Published processing event",
    );
  } catch (error) {
    workerLogger.error({ error }, "Failed to publish processing event");
  }
}
