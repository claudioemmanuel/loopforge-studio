import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const revalidate = 60;

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  database: {
    connected: boolean;
    schemaValid?: boolean;
    missingColumns?: string[];
  };
  message?: string;
}

export async function GET() {
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    database: {
      connected: false,
    },
  };

  try {
    // Test database connectivity
    await db.execute(sql`SELECT 1`);
    health.database.connected = true;

    // Validate critical schema columns
    const schemaCheck = await validateSchema();
    health.database.schemaValid = schemaCheck.valid;
    health.database.missingColumns = schemaCheck.missingColumns;

    if (!schemaCheck.valid) {
      health.status = "degraded";
      health.message = "Database schema outdated. Run: npm run db:migrate";
    }
  } catch (error) {
    health.status = "unhealthy";
    health.database.connected = false;
    health.message = error instanceof Error ? error.message : "Unknown error";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}

async function validateSchema() {
  const requiredColumns = [
    { table: "users", column: "default_clone_directory" },
    { table: "executions", column: "skill_executions" },
  ];

  const missingColumns: string[] = [];

  for (const { table, column } of requiredColumns) {
    try {
      const result = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = ${table}
        AND column_name = ${column}
      `);

      if (result.rows.length === 0) {
        missingColumns.push(`${table}.${column}`);
      }
    } catch (error) {
      missingColumns.push(`${table}.${column} (check failed)`);
    }
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
  };
}
