import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Check if we're in build mode (no real database available)
const isBuildTime =
  process.env.DATABASE_URL?.includes("build:build@localhost") ||
  process.env.NEXT_PHASE === "phase-production-build";

let pool: Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL environment variable is required. " +
          "Please set it in your .env file. See .env.example for reference.",
      );
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// Lazy-initialized database connection
// Returns null during build time to prevent connection errors
function getDb(): NodePgDatabase<typeof schema> {
  if (isBuildTime) {
    // Return a proxy that throws helpful errors if actually used during build
    return new Proxy({} as NodePgDatabase<typeof schema>, {
      get(_, prop) {
        if (prop === "then") return undefined; // Allow Promise checks
        console.warn(
          `[DB] Skipping database operation during build time: ${String(prop)}`,
        );
        return () => Promise.resolve([]);
      },
    });
  }

  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export const db = getDb();
export * from "./schema";
export * from "./status-history";
