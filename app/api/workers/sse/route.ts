import { auth } from "@/lib/auth";
import type { ProcessingPhase } from "@/lib/db/schema";
import { connectionOptions } from "@/lib/queue/connection";
import Redis from "ioredis";
import { apiLogger } from "@/lib/logger";
import { getTaskService } from "@/lib/contexts/task/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to get default status text for a processing phase
function getDefaultStatusText(phase: ProcessingPhase | "recovering"): string {
  switch (phase) {
    case "brainstorming":
      return "Starting brainstorm...";
    case "planning":
      return "Starting plan generation...";
    case "executing":
      return "Starting execution...";
    case "recovering":
      return "Recovering task...";
    default:
      return "Processing...";
  }
}

// Helper to get initial worker data via TaskService
async function getInitialWorkers(userId: string) {
  const taskService = getTaskService();
  const {
    tasks: workerTasks,
    repoMap,
    executionMap,
  } = await taskService.listActiveWorkerTasks(userId);

  return workerTasks.map((task) => {
    const repo = repoMap.get(task.repoId);
    const execution = executionMap.get(task.id);

    let progress = 0;
    let currentAction: string | undefined;

    // If task is actively processing, use the processing status text
    if (task.processingPhase) {
      if (!task.processingProgress || task.processingProgress === 0) {
        progress = 5;
        currentAction =
          task.processingStatusText ||
          getDefaultStatusText(task.processingPhase);
      } else {
        progress = task.processingProgress;
        currentAction =
          task.processingStatusText ||
          getDefaultStatusText(task.processingPhase);
      }
    } else {
      switch (task.status) {
        case "brainstorming":
          progress = 20;
          currentAction = "Generating ideas...";
          break;
        case "planning":
          progress = 40;
          currentAction = "Creating execution plan...";
          break;
        case "ready":
          progress = 60;
          currentAction = "Ready to execute";
          break;
        case "executing":
          progress = 80;
          currentAction = "Executing...";
          break;
        case "done":
          progress = 100;
          break;
        case "stuck":
          progress = execution?.iteration
            ? Math.min(60 + execution.iteration * 5, 95)
            : 50;
          break;
      }
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      repoId: task.repoId,
      repoName: repo?.name || "Unknown",
      status: task.status,
      progress,
      currentAction,
      error: execution?.errorMessage || undefined,
      completedAt: execution?.completedAt?.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      processingPhase: task.processingPhase,
      processingJobId: task.processingJobId,
      processingStartedAt: task.processingStartedAt?.toISOString(),
      autonomousMode: task.autonomousMode,
    };
  });
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Create response with SSE headers
  const encoder = new TextEncoder();
  let redis: Redis | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial worker list
      try {
        const initialWorkers = await getInitialWorkers(userId);
        const initialEvent = {
          type: "worker_list",
          data: initialWorkers,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`),
        );
      } catch (error) {
        apiLogger.error({ error }, "Error fetching initial workers");
      }

      // Set up Redis subscription for real-time updates
      try {
        redis = new Redis({
          host: connectionOptions.host,
          port: connectionOptions.port,
          password: connectionOptions.password,
          username: connectionOptions.username,
        });

        const channel = `worker-events:${userId}`;
        await redis.subscribe(channel);

        redis.on("message", (ch, message) => {
          if (ch === channel && !closed) {
            try {
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            } catch (error) {
              apiLogger.error({ error }, "Error sending SSE message");
            }
          }
        });

        redis.on("error", (error) => {
          apiLogger.error({ error }, "Redis subscription error");
        });
      } catch (error) {
        apiLogger.error({ error }, "Failed to set up Redis subscription");
        // Fall back to polling-style updates with exponential backoff
        let pollDelay = 5000;
        const maxDelay = 30000;
        const backoffMultiplier = 1.5;

        const poll = async () => {
          if (closed) return;
          try {
            const workers = await getInitialWorkers(userId);
            const event = {
              type: "worker_list",
              data: workers,
              timestamp: new Date().toISOString(),
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          } catch (err) {
            apiLogger.error({ err }, "Polling error");
          }
          pollDelay = Math.min(pollDelay * backoffMultiplier, maxDelay);
          if (!closed) {
            setTimeout(poll, pollDelay);
          }
        };
        setTimeout(poll, pollDelay);
      }

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);
    },

    cancel() {
      closed = true;
      if (redis) {
        redis.unsubscribe();
        redis.quit();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
