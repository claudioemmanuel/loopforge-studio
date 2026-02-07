/**
 * Schema Drift Detection & Auto-Fix
 *
 * Compares TypeScript schema definitions (Drizzle ORM) against actual PostgreSQL
 * columns/enums and auto-applies ALTER TABLE ADD COLUMN IF NOT EXISTS for any
 * missing columns. Also creates missing enum types and adds missing enum values.
 *
 * Usage: npx tsx scripts/validate-schema.ts
 */

import { getTableConfig, isPgEnum } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import pg from "pg";
import fs from "fs";
import path from "path";
import * as tables from "../lib/db/schema/tables";
import * as enums from "../lib/db/schema/enums";

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSqlDefault(column: PgColumn): string | null {
  if (!column.hasDefault) return null;

  const def = column.default;

  // SQL expressions (e.g. gen_random_uuid(), now())
  if (def instanceof SQL) {
    // Extract the SQL string from queryChunks
    const chunks = (def as unknown as { queryChunks: { value: string[] }[] })
      .queryChunks;
    if (chunks?.[0]?.value?.[0]) {
      return chunks[0].value[0];
    }
    // Fallback for common column types
    if (column.columnType === "PgUUID") return "gen_random_uuid()";
    if (column.columnType === "PgTimestamp") return "now()";
    return null;
  }

  // Primitive defaults
  if (typeof def === "string") return `'${def.replace(/'/g, "''")}'`;
  if (typeof def === "number") return String(def);
  if (typeof def === "boolean") return String(def);

  // Array / object defaults (jsonb)
  if (Array.isArray(def)) return `'[]'::jsonb`;
  if (typeof def === "object" && def !== null) return `'{}'::jsonb`;

  return null;
}

function buildAddColumnSQL(tableName: string, column: PgColumn): string {
  const sqlType = column.getSQLType();
  const notNull = column.notNull;
  const defaultExpr = getSqlDefault(column);

  let sql = `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${column.name}" ${sqlType}`;

  if (defaultExpr !== null) {
    sql += ` DEFAULT ${defaultExpr}`;
  }

  // Only add NOT NULL if there's a default (otherwise adding NOT NULL to an
  // existing table with rows would fail)
  if (notNull && defaultExpr !== null) {
    sql += ` NOT NULL`;
  }

  return sql;
}

async function loadDbColumns(pool: pg.Pool): Promise<Map<string, Set<string>>> {
  const { rows } = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);

  const dbColumns = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!dbColumns.has(row.table_name)) {
      dbColumns.set(row.table_name, new Set());
    }
    dbColumns.get(row.table_name)!.add(row.column_name);
  }

  return dbColumns;
}

async function recoverActivityTrackingTables(pool: pg.Pool): Promise<boolean> {
  const migrationPath = path.join(
    process.cwd(),
    "drizzle",
    "0045_recover_activity_tracking_tables.sql",
  );

  if (!fs.existsSync(migrationPath)) {
    return false;
  }

  const sql = fs.readFileSync(migrationPath, "utf-8");
  await pool.query(sql);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Nothing to validate without a database
    process.exit(0);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Quick connectivity check
    await pool.query("SELECT 1");
  } catch {
    // Database not available — skip silently
    await pool.end();
    process.exit(0);
  }

  let fixedColumns = 0;
  const fixedTables = new Set<string>();
  let fixedEnums = 0;
  let recoveredActivityTables = false;

  try {
    // -----------------------------------------------------------------------
    // 1. Validate Enums
    // -----------------------------------------------------------------------

    // Get existing enum types and their values from the database
    const { rows: dbEnumRows } = await pool.query(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      ORDER BY t.typname, e.enumsortorder
    `);

    const dbEnums = new Map<string, Set<string>>();
    for (const row of dbEnumRows) {
      if (!dbEnums.has(row.enum_name)) {
        dbEnums.set(row.enum_name, new Set());
      }
      dbEnums.get(row.enum_name)!.add(row.enum_value);
    }

    // Check each TypeScript enum definition
    for (const [, value] of Object.entries(enums)) {
      if (!isPgEnum(value)) continue;

      const enumName = (value as { enumName: string }).enumName;
      const enumValues = (value as { enumValues: string[] }).enumValues;

      if (!dbEnums.has(enumName)) {
        // Enum type doesn't exist — create it
        const valuesList = enumValues.map((v) => `'${v}'`).join(", ");
        await pool.query(`CREATE TYPE "${enumName}" AS ENUM (${valuesList})`);
        console.log(`  Fixed: Created enum type "${enumName}"`);
        fixedEnums++;
      } else {
        // Enum exists — check for missing values
        const existing = dbEnums.get(enumName)!;
        for (const val of enumValues) {
          if (!existing.has(val)) {
            await pool.query(
              `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${val}'`,
            );
            console.log(`  Fixed: Added value '${val}' to enum "${enumName}"`);
            fixedEnums++;
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. Validate Tables & Columns
    // -----------------------------------------------------------------------

    let dbColumns = await loadDbColumns(pool);

    // Some environments have historical migration journal drift where 0045
    // is marked as applied but activity tracking tables are missing.
    if (
      !dbColumns.has("activity_events") ||
      !dbColumns.has("activity_summaries")
    ) {
      const recovered = await recoverActivityTrackingTables(pool);
      if (recovered) {
        recoveredActivityTables = true;
        console.log("  Fixed: Recovered activity tracking tables");
        dbColumns = await loadDbColumns(pool);
      }
    }

    // Check each TypeScript table definition
    for (const [, tableValue] of Object.entries(tables)) {
      // Skip non-table exports (types, etc.)
      let config;
      try {
        config = getTableConfig(
          tableValue as Parameters<typeof getTableConfig>[0],
        );
      } catch {
        continue;
      }

      const tableName = config.name;
      const existingCols = dbColumns.get(tableName);

      if (!existingCols) {
        // Table doesn't exist at all — skip (migrations should create tables)
        continue;
      }

      for (const column of config.columns) {
        if (existingCols.has(column.name)) continue;

        // Column is missing — add it
        const sql = buildAddColumnSQL(tableName, column);
        try {
          await pool.query(sql);
          console.log(
            `  Fixed: Added "${tableName}"."${column.name}" (${column.getSQLType()})`,
          );
          fixedColumns++;
          fixedTables.add(tableName);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Skip "already exists" race conditions
          if (!msg.includes("already exists")) {
            console.error(
              `  Error: Could not add "${tableName}"."${column.name}": ${msg}`,
            );
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 3. Summary
    // -----------------------------------------------------------------------

    if (fixedColumns > 0 || fixedEnums > 0 || recoveredActivityTables) {
      const parts: string[] = [];
      if (fixedColumns > 0) {
        parts.push(
          `${fixedColumns} column(s) across ${fixedTables.size} table(s)`,
        );
      }
      if (fixedEnums > 0) {
        parts.push(`${fixedEnums} enum fix(es)`);
      }
      if (recoveredActivityTables) {
        parts.push("activity tracking tables recovered");
      }
      console.log(`  Schema drift fixed: ${parts.join(", ")}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Schema validation error: ${msg}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
