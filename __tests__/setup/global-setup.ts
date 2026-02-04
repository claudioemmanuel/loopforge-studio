import { Pool } from "pg";

type EnvLike = Record<string, string | undefined>;

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/loopforge_test";
const DEFAULT_ADMIN_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/postgres";
const TEST_DATABASE_NAME = "loopforge_test";

export function resolveTestDatabaseConfig(env: EnvLike) {
  const testDatabaseUrl =
    env.TEST_DATABASE_URL || env.DATABASE_URL || DEFAULT_TEST_DATABASE_URL;

  const candidateAdminUrl =
    env.ADMIN_DATABASE_URL ||
    env.TEST_DATABASE_ADMIN_URL ||
    env.DATABASE_URL ||
    DEFAULT_ADMIN_DATABASE_URL;

  const adminUrl = candidateAdminUrl.includes(`/${TEST_DATABASE_NAME}`)
    ? DEFAULT_ADMIN_DATABASE_URL
    : candidateAdminUrl;

  return {
    testDatabaseUrl,
    adminUrl,
    testDbName: TEST_DATABASE_NAME,
  };
}

export default async function globalSetup() {
  const envSnapshot = { ...process.env };
  const { testDatabaseUrl, adminUrl, testDbName } =
    resolveTestDatabaseConfig(envSnapshot);

  // Set DATABASE_URL for modules that require it at import time
  process.env.DATABASE_URL = testDatabaseUrl;

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
