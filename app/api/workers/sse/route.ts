import { auth } from "@/lib/auth";
import { db, tasks, repos } from "@/lib/db";
import type { TaskStatus, Execution, ProcessingPhase } from "@/lib/db/schema";
import { eq, and, or, inArray, desc, isNotNull, sql } from "drizzle-orm";
import { connectionOptions } from "@/lib/queue/connection";
import Redis from "ioredis";
import { apiLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to get default status text for a processing phase
function getDefaultStatusText(phase: ProcessingPhase): string {
  switch (phase) {
    case "brainstorming":
      return "Starting brainstorm...";
    case "planning":
      return "Starting plan generation...";
    case "executing":
      return "Starting execution...";
    default:
      return "Processing...";
  }
}

// Helper to get initial worker data
async function getInitialWorkers(userId: string) {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });

  if (userRepos.length === 0) {
    return [];
  }

  const repoIds = userRepos.map((r) => r.id);
  const repoMap = new Map(userRepos.map((r) => [r.id, r]));

  // Get tasks with ACTIVE workers:
  // 1. Autonomous mode tasks (legacy)
  // 2. Tasks currently processing (processingPhase set - background job running)
  // 3. Tasks that failed (stuck status)
  const workerTasks = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.repoId, repoIds),
      or(
        // Autonomous mode tasks (legacy)
        eq(tasks.autonomousMode, true),
        // Any task currently processing (background job running)
        isNotNull(tasks.processingPhase),
        // Failed tasks
        eq(tasks.status, "stuck" as TaskStatus),
      ),
    ),
    orderBy: [desc(tasks.updatedAt)],
    limit: 50,
  });

  // Alias for backwards compatibility
  const autonomousTasks = workerTasks;

  // Get latest execution per task using DISTINCT ON for efficiency
  const taskIds = autonomousTasks.map((t) => t.id);
  const executionMap = new Map<string, Execution>();

  if (taskIds.length > 0) {
    // Use DISTINCT ON to get only the latest execution per task
    // Format array as PostgreSQL array literal for ANY operator
    const taskIdsArray = sql.raw(
      `ARRAY[${taskIds.map((id) => `'${id}'`).join(",")}]::uuid[]`,
    );
    const latestExecutions = await db.execute<Execution>(sql`
      SELECT DISTINCT ON (task_id) *
      FROM executions
      WHERE task_id = ANY(${taskIdsArray})
      ORDER BY task_id, created_at DESC
    `);

    for (const exec of latestExecutions.rows) {
      executionMap.set(exec.taskId, exec);
    }
  }

  return autonomousTasks.map((task) => {
    const repo = repoMap.get(task.repoId);
    const execution = executionMap.get(task.id);

    let progress = 0;
    let currentAction: string | undefined;

    // If task is actively processing, use the processing status text and stored progress
    if (task.processingPhase) {
      // Provide defaults for tasks that just started processing (race condition fix)
      if (!task.processingProgress || task.processingProgress === 0) {
        progress = 5; // Show minimal progress to indicate processing started
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
      // Use status-based progress for non-processing tasks
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
      // Include processing state for card processing hook
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
              // Stream may be closed
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
        let pollDelay = 5000; // Start at 5s
        const maxDelay = 30000; // Cap at 30s
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
          // Increase delay with exponential backoff, capped at maxDelay
          pollDelay = Math.min(pollDelay * backoffMultiplier, maxDelay);
          if (!closed) {
            setTimeout(poll, pollDelay);
          }
        };
        // Start the polling chain
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
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
