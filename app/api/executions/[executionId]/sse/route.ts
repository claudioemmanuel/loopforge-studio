import { auth } from "@/lib/auth";
import { db, executions, executionEvents } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { connectionOptions } from "@/lib/queue/connection";
import Redis from "ioredis";
import { apiLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const session = await auth();
  const { executionId } = await params;

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify ownership via execution -> task -> repo chain
  const execution = await db.query.executions.findFirst({
    where: eq(executions.id, executionId),
    with: {
      task: {
        with: {
          repo: true,
        },
      },
    },
  });

  if (!execution || execution.task.repo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let redis: Redis | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial burst of existing events
      try {
        const existingEvents = await db.query.executionEvents.findMany({
          where: eq(executionEvents.executionId, executionId),
          orderBy: [asc(executionEvents.createdAt)],
        });

        for (const e of existingEvents) {
          const event = {
            id: e.id,
            type: e.eventType,
            content: e.content,
            timestamp: e.createdAt,
            metadata: e.metadata,
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        }
      } catch (error) {
        apiLogger.error({ error }, "Error fetching initial execution events");
      }

      // Subscribe to Redis channel for real-time updates
      try {
        redis = new Redis({
          host: connectionOptions.host,
          port: connectionOptions.port,
          password: connectionOptions.password,
          username: connectionOptions.username,
        });

        const channel = `execution-events:${executionId}`;
        await redis.subscribe(channel);

        redis.on("message", (ch, message) => {
          if (ch === channel && !closed) {
            try {
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            } catch (error) {
              apiLogger.error({ error }, "Error sending execution SSE message");
            }
          }
        });

        redis.on("error", (error) => {
          apiLogger.error(
            { error },
            "Redis subscription error for execution events",
          );
        });
      } catch (error) {
        apiLogger.error(
          { error },
          "Failed to set up Redis subscription for execution events",
        );
      }

      // Heartbeat every 30s
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
