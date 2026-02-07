/**
 * System Health Repository (Infrastructure Layer)
 *
 * Data access layer for system health checks.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export class SystemHealthRepository {
  async checkConnection(): Promise<void> {
    await db.execute(sql`SELECT 1`);
  }

  async getColumnInfo(table: string, column: string) {
    return db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${table}
      AND column_name = ${column}
    `);
  }
}
