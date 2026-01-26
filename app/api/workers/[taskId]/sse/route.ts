import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { connectionOptions } from "@/lib/queue/connection";
import Redis from "ioredis";
import { apiLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { taskId } = await params;
  const userId = session.user.id;

  // Verify the user owns the task
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      repo: true,
    },
  });

  if (!task) {
    return new Response("Task not found", { status: 404 });
  }

  if (task.repo.userId !== userId) {
    return new Response("Unauthorized", { status: 403 });
  }

  const encoder = new TextEncoder();
  let redis: Redis | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
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
              // Parse the message and filter for this specific task
              const event = JSON.parse(message);
              if (event.data?.taskId === taskId || event.taskId === taskId) {
                controller.enqueue(encoder.encode(`data: ${message}\n\n`));
              }
            } catch {
              // If parsing fails, still try to send if it contains the taskId
              if (message.includes(taskId)) {
                controller.enqueue(encoder.encode(`data: ${message}\n\n`));
              }
            }
          }
        });

        redis.on("error", (error) => {
          apiLogger.error({ error }, "Redis subscription error");
        });
      } catch (error) {
        apiLogger.error({ error }, "Failed to set up Redis subscription");
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
