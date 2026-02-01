/**
 * Script to manually apply subscription limit constraint migration
 * Run with: DATABASE_URL=postgresql://... npx tsx scripts/apply-limit-constraint.ts
 */

import pg from "pg";
import { readFileSync } from "fs";
import { join } from "path";

const { Pool } = pg;

async function applyLimitConstraint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Applying subscription limit constraint migration...");

    // Read the migration SQL
    const migrationPath = join(
      process.cwd(),
      "drizzle",
      "0039_subscription_limit_constraints.sql",
    );
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("Migration SQL:");
    console.log(migrationSql);
    console.log("\n");

    // Execute the migration
    await pool.query(migrationSql);

    console.log("✅ Migration applied successfully!");

    // Test the constraint
    console.log("\nTesting constraint...");

    // Check if trigger exists
    const triggerCheck = await pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE trigger_name = 'enforce_repo_limit'
    `);

    if (triggerCheck.rows.length > 0) {
      console.log("✅ Trigger 'enforce_repo_limit' exists");
    } else {
      console.log("❌ Trigger 'enforce_repo_limit' not found");
    }

    // Check if function exists
    const functionCheck = await pool.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'check_repo_limit'
    `);

    if (functionCheck.rows.length > 0) {
      console.log("✅ Function 'check_repo_limit' exists");
    } else {
      console.log("❌ Function 'check_repo_limit' not found");
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error applying migration:", error);
    await pool.end();
    process.exit(1);
  }
}

applyLimitConstraint();
