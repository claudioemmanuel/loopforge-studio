/**
 * System Health Service (Application Layer)
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export class SystemHealthService {
  async checkDatabaseConnection(): Promise<boolean> {
    await db.execute(sql`SELECT 1`);
    return true;
  }

  async validateColumns(
    requiredColumns: Array<{ table: string; column: string }>,
  ) {
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
      } catch {
        missingColumns.push(`${table}.${column} (check failed)`);
      }
    }

    return {
      valid: missingColumns.length === 0,
      missingColumns,
    };
  }
}
