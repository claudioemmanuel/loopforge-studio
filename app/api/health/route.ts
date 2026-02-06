import { NextResponse } from "next/server";
import {
  getHandlerHealthStatus,
  areAllHandlersHealthy,
  type HandlerHealth,
} from "@/lib/contexts/event-initialization";
import { getSystemHealthService } from "@/lib/contexts/system/api";

export const revalidate = 60;

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: {
      connected: boolean;
      schemaValid?: boolean;
      missingColumns?: string[];
    };
    eventHandlers: {
      status: "healthy" | "degraded";
      handlers: HandlerHealth[];
    };
  };
  message?: string;
}

export async function GET() {
  const systemHealthService = getSystemHealthService();
  let dbConnected = false;
  let schemaValid = false;
  let missingColumns: string[] = [];
  let dbError: string | undefined;

  // Check database
  try {
    await systemHealthService.checkDatabaseConnection();
    dbConnected = true;

    // Validate critical schema columns
    const schemaCheck = await systemHealthService.validateColumns([
      { table: "users", column: "default_clone_directory" },
      { table: "executions", column: "skill_executions" },
    ]);
    schemaValid = schemaCheck.valid;
    missingColumns = schemaCheck.missingColumns;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Unknown error";
  }

  // Check event handlers
  const eventHandlers = getHandlerHealthStatus();
  const handlersHealthy = areAllHandlersHealthy();

  // Determine overall status
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  let message: string | undefined;

  if (!dbConnected) {
    overallStatus = "unhealthy";
    message = dbError || "Database connection failed";
  } else if (!schemaValid) {
    overallStatus = "degraded";
    message = "Database schema outdated. Run: npm run db:migrate";
  } else if (!handlersHealthy) {
    overallStatus = "degraded";
    message = "One or more event handlers failed to initialize";
  }

  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: {
        connected: dbConnected,
        schemaValid,
        missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
      },
      eventHandlers: {
        status: handlersHealthy ? "healthy" : "degraded",
        handlers: eventHandlers,
      },
    },
    message,
  };

  const statusCode = health.status === "healthy" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
