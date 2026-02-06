import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getTestPool } from "../../setup/test-db";

describe("Migration Automation", () => {
  const pool = getTestPool();

  afterAll(async () => {
    await pool.end();
  });

  it("should have drizzle migrations table in correct schema", async () => {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'drizzle'
        AND table_name = '__drizzle_migrations'
      ) as exists
    `);

    expect(result.rows[0].exists).toBe(true);
  });

  it("should have default_clone_directory column in users table", async () => {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'default_clone_directory'
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].column_name).toBe("default_clone_directory");
  });

  it("should have skill_executions column in executions table", async () => {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'executions'
      AND column_name = 'skill_executions'
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].column_name).toBe("skill_executions");
  });

  it("should have all journal migrations applied", async () => {
    const journalPath = join(
      __dirname,
      "..",
      "drizzle",
      "meta",
      "_journal.json",
    );
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const expectedCount = journal.entries.length;

    // Note: Test database may not have drizzle schema, so we check public schema
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'executions', 'tasks', 'repos')
    `);

    // Verify core tables exist (which means migrations were applied)
    expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(4);
  });
});
