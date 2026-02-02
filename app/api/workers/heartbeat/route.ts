import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workerHeartbeats } from "@/lib/db/schema";
import { handleError, Errors } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Worker Heartbeat Endpoint
 *
 * Workers call this endpoint every 30 seconds to signal they're alive.
 * This endpoint creates a heartbeat record in workerHeartbeats that the health
 * dashboard uses to determine if the worker is running.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify worker authentication
    const authHeader = request.headers.get("x-worker-token");
    const expectedToken = process.env.WORKER_SECRET || "development-worker-secret";

    if (authHeader !== expectedToken) {
      return handleError(Errors.unauthorized("Invalid worker token"));
    }

    // Get worker info from request body
    const body = await request.json().catch(() => ({}));
    const { workerId = "worker-1", version = "unknown" } = body;

    // Create heartbeat record
    await db.insert(workerHeartbeats).values({
      workerId,
      timestamp: new Date(),
      metadata: {
        version,
        uptime: process.uptime(),
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error recording worker heartbeat:", error);
    return handleError(Errors.internal("Failed to record heartbeat"));
  }
}

/**
 * GET endpoint to retrieve latest heartbeat (for debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const latestHeartbeat = await db.query.workerHeartbeats.findFirst({
      orderBy: (heartbeats, { desc }) => [desc(heartbeats.timestamp)],
    });

    if (!latestHeartbeat) {
      return NextResponse.json({
        heartbeat: null,
        message: "No heartbeat found",
      });
    }

    return NextResponse.json({
      heartbeat: latestHeartbeat.timestamp,
      workerId: latestHeartbeat.workerId,
      metadata: latestHeartbeat.metadata,
    });
  } catch (error) {
    console.error("Error retrieving heartbeat:", error);
    return handleError(Errors.internal("Failed to retrieve heartbeat"));
  }
}
