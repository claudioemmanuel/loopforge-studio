/**
 * Execution Service integration tests (current application-layer contract).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  executionCommits,
  executions,
  repos,
  tasks,
  testRuns,
  users,
} from "@/lib/db/schema/tables";
import { ExecutionService } from "@/lib/contexts/execution/application/execution-service";

describe("ExecutionService", () => {
  let redis: Redis;
  let executionService: ExecutionService;
  let userId: string;
  let repoId: string;
  let taskId: string;
  let executionId: string;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    executionService = new ExecutionService(redis);
  });

  beforeEach(async () => {
    const unique = `${Date.now()}-${Math.random()}`;
    userId = randomUUID();

    await db.insert(users).values({
      id: userId,
      githubId: `gh-${unique}`,
      username: `user-${unique}`,
      email: `user-${unique}@example.com`,
    });

    repoId = randomUUID();
    await db.insert(repos).values({
      id: repoId,
      userId,
      githubRepoId: `repo-${unique}`,
      name: "exec-repo",
      fullName: `owner/exec-repo-${unique}`,
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/exec-repo.git",
    });

    taskId = randomUUID();
    await db.insert(tasks).values({
      id: taskId,
      repoId,
      title: "Execution Task",
      status: "ready",
    });

    executionId = randomUUID();
    await executionService.createQueued({
      id: executionId,
      taskId,
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("creates queued execution and supports core lifecycle updates", async () => {
    let row = await executionService.getById(executionId);
    expect(row?.status).toBe("queued");

    await executionService.markRunning(executionId);
    row = await executionService.getById(executionId);
    expect(row?.status).toBe("running");
    expect(row?.startedAt).toBeTruthy();

    await executionService.markCompleted({
      executionId,
      commits: ["abc123"],
      prUrl: "https://github.com/owner/repo/pull/1",
      prNumber: 1,
    });
    row = await executionService.getById(executionId);
    expect(row?.status).toBe("completed");
    expect(row?.commits).toEqual(["abc123"]);
    expect(row?.prNumber).toBe(1);
  });

  it("handles failed and stuck terminal states", async () => {
    const failedId = randomUUID();
    await executionService.create({ id: failedId, taskId, status: "queued" });
    await executionService.markFailed(failedId, "boom");
    const failed = await executionService.getById(failedId);
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("boom");

    const stuckId = randomUUID();
    await executionService.create({ id: stuckId, taskId, status: "queued" });
    await executionService.markStuck(stuckId, [{ type: "loop", count: 3 }]);
    const stuck = await executionService.getById(stuckId);
    expect(stuck?.status).toBe("stuck");
  });

  it("lists latest and task executions", async () => {
    const secondId = randomUUID();
    await executionService.create({ id: secondId, taskId, status: "queued" });

    const list = await executionService.listByTask(taskId);
    const latest = await executionService.getLatestForTask(taskId);

    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(latest).toBeTruthy();
    expect(list.some((execution) => execution.id === secondId)).toBe(true);
  });

  it("updates arbitrary fields and deletes records", async () => {
    await executionService.updateFields(executionId, {
      iteration: 5,
      errorMessage: "transient",
    });

    const updated = await executionService.getById(executionId);
    expect(updated?.iteration).toBe(5);
    expect(updated?.errorMessage).toBe("transient");

    await executionService.deleteById(executionId);
    const deleted = await executionService.getById(executionId);
    expect(deleted).toBeNull();
  });

  it("records and reads execution commits", async () => {
    const commit = await executionService.recordCommit({
      executionId,
      commitSha: "abc123",
      commitMessage: "feat: add endpoint",
      filesChanged: ["app/api/route.ts"],
    });

    expect(commit.executionId).toBe(executionId);
    const commits = await executionService.getCommits(executionId);
    expect(commits).toHaveLength(1);
    expect(commits[0].commitSha).toBe("abc123");
  });

  it("reports rollback eligibility and performs rollback", async () => {
    await db
      .update(executions)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(executions.id, executionId));

    await db.insert(executionCommits).values({
      id: randomUUID(),
      executionId,
      commitSha: "c1",
      commitMessage: "feat: c1",
      filesChanged: ["a.ts"],
      isReverted: false,
    });

    const eligibility = await executionService.canRollback(executionId);
    expect(eligibility.canRollback).toBe(true);

    await executionService.rollbackCommits({
      executionId,
      revertCommitSha: "revert1",
      reason: "manual rollback",
    });

    const commits = await executionService.getCommits(executionId);
    expect(commits.every((commit) => commit.isReverted)).toBe(true);
  });

  it("loads latest test-run summary for execution", async () => {
    await db.insert(testRuns).values({
      id: randomUUID(),
      executionId,
      taskId,
      command: "npm test",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      durationMs: 1200,
      status: "passed",
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const summary = await executionService.getTestRunForExecution(executionId);
    expect(summary).toBeTruthy();
    expect(summary?.command).toBe("npm test");
    expect(summary?.hasOutput).toBe(true);
  });

  it("deletes test runs by execution", async () => {
    await db.insert(testRuns).values({
      id: randomUUID(),
      executionId,
      taskId,
      command: "npm test",
      status: "failed",
      startedAt: new Date(),
    });

    const removed =
      await executionService.deleteTestRunsForExecution(executionId);
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
