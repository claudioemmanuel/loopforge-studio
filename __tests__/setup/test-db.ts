import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/loopforge_test";

// Singleton pool with max 5 connections
let pool: Pool | null = null;

export function getTestPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}

export function getTestDb() {
  return drizzle(getTestPool(), { schema });
}

export async function closeTestPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function truncateAllTables() {
  const p = getTestPool();
  await p.query(`
    TRUNCATE usage_records, user_subscriptions, subscription_plans,
             execution_events, executions, tasks, repos, users CASCADE;
  `);
}
