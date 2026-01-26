import { Pool } from "pg";

export default async function globalSetup() {
  // Set DATABASE_URL for modules that require it at import time
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/loopforge_test";
  process.env.DATABASE_URL = testDatabaseUrl;

  const adminUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/postgres";
  const testDbName = "loopforge_test";

  const pool = new Pool({ connectionString: adminUrl });

  try {
    // Check if test database exists
    const result = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [testDbName],
    );

    if (result.rowCount === 0) {
      // Create the test database
      await pool.query(`CREATE DATABASE ${testDbName}`);
      console.log(`Created test database: ${testDbName}`);
    }
  } finally {
    await pool.end();
  }
}
