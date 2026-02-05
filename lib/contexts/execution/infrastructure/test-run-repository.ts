/**
 * Test Run Repository (Infrastructure Layer)
 * CRUD operations for test execution results
 */

import { db } from "@/lib/db";
import {
  testRuns,
  type TestRun,
  type NewTestRun,
  type TestRunStatus,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Create a new test run record
 */
export async function createTestRun(data: NewTestRun): Promise<TestRun> {
  const [result] = await db.insert(testRuns).values(data).returning();
  return result;
}

/**
 * Get a test run by ID
 */
export async function getTestRunById(id: string): Promise<TestRun | null> {
  const [result] = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.id, id))
    .limit(1);
  return result ?? null;
}

/**
 * Get the test run for an execution
 */
export async function getTestRunByExecution(
  executionId: string,
): Promise<TestRun | null> {
  const [result] = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.executionId, executionId))
    .limit(1);
  return result ?? null;
}

/**
 * Get all test runs for a task
 */
export async function getTestRunsByTask(taskId: string): Promise<TestRun[]> {
  return await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.taskId, taskId))
    .orderBy(desc(testRuns.startedAt));
}

/**
 * Get the latest test run for a task
 */
export async function getLatestTestRun(
  taskId: string,
): Promise<TestRun | null> {
  const [result] = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.taskId, taskId))
    .orderBy(desc(testRuns.startedAt))
    .limit(1);
  return result ?? null;
}

/**
 * Update a test run
 */
export async function updateTestRun(
  id: string,
  data: Partial<Omit<TestRun, "id" | "startedAt">>,
): Promise<TestRun | null> {
  const [result] = await db
    .update(testRuns)
    .set(data)
    .where(eq(testRuns.id, id))
    .returning();
  return result ?? null;
}

/**
 * Complete a test run with results
 */
export async function completeTestRun(
  id: string,
  data: {
    status: TestRunStatus;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
  },
): Promise<TestRun | null> {
  return updateTestRun(id, {
    status: data.status,
    exitCode: data.exitCode,
    stdout: data.stdout,
    stderr: data.stderr,
    durationMs: data.durationMs,
    completedAt: new Date(),
  });
}

/**
 * Delete a test run
 */
export async function deleteTestRun(id: string): Promise<boolean> {
  const result = await db.delete(testRuns).where(eq(testRuns.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete test runs for an execution
 */
export async function deleteTestRunsByExecution(
  executionId: string,
): Promise<number> {
  const result = await db
    .delete(testRuns)
    .where(eq(testRuns.executionId, executionId));
  return result.rowCount ?? 0;
}

/**
 * Check if tests passed for an execution
 */
export async function didTestsPass(
  executionId: string,
): Promise<boolean | null> {
  const testRun = await getTestRunByExecution(executionId);
  if (!testRun) return null; // No tests run
  return testRun.status === "passed";
}

/**
 * Get test run summary for display
 */
export function getTestRunSummary(testRun: TestRun): {
  status: TestRunStatus;
  statusText: string;
  durationText: string;
  hasOutput: boolean;
} {
  const statusTexts: Record<TestRunStatus, string> = {
    running: "Running tests...",
    passed: "All tests passed",
    failed: "Tests failed",
    timeout: "Tests timed out",
    skipped: "Tests skipped",
  };

  let durationText = "";
  if (testRun.durationMs) {
    if (testRun.durationMs < 1000) {
      durationText = `${testRun.durationMs}ms`;
    } else if (testRun.durationMs < 60000) {
      durationText = `${(testRun.durationMs / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(testRun.durationMs / 60000);
      const seconds = ((testRun.durationMs % 60000) / 1000).toFixed(0);
      durationText = `${minutes}m ${seconds}s`;
    }
  }

  return {
    status: testRun.status,
    statusText: statusTexts[testRun.status],
    durationText,
    hasOutput: !!(testRun.stdout || testRun.stderr),
  };
}
