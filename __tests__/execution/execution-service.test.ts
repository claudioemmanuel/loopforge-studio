/**
 * Execution Service Integration Tests
 *
 * Tests execution lifecycle, iteration tracking, and recovery.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users, repos, tasks, domainEvents } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import { ExecutionService } from "@/lib/contexts/execution/application/execution-service";
import type {
  ExtractionResult,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "@/lib/contexts/execution/domain/types";
import { randomUUID } from "crypto";

describe("Execution Service", () => {
  let redis: Redis;
  let executionService: ExecutionService;
  let userId: string;
  let repositoryId: string;
  let taskId: string;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    executionService = new ExecutionService(redis);
  });

  beforeEach(async () => {
    // Create test user
    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      githubId: `github-${userId}`,
      username: `testuser-${userId.substring(0, 8)}`,
      email: `test-${userId.substring(0, 8)}@example.com`,
    });

    // Create test repository
    repositoryId = randomUUID();
    await db.insert(repos).values({
      id: repositoryId,
      userId,
      githubRepoId: "123456",
      name: "test-repo",
      fullName: "testuser/test-repo",
      defaultBranch: "main",
      cloneUrl: "https://github.com/testuser/test-repo.git",
      isPrivate: false,
    });

    // Create test task
    taskId = randomUUID();
    await db.insert(tasks).values({
      id: taskId,
      repoId: repositoryId,
      title: "Test Task",
      status: "ready",
    });
  });

  afterAll(async () => {
    await db.delete(domainEvents);
    await db.delete(users);
    await redis.quit();
  });

  it("should start execution and publish ExecutionStarted event", async () => {
    // Act
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Assert
    expect(executionId).toBeDefined();

    // Verify execution was created
    const execution = await executionService.getExecution(executionId);
    expect(execution).not.toBeNull();
    expect(execution?.taskId).toBe(taskId);
    expect(execution?.status).toBe("running");
    expect(execution?.branchName).toBe("loopforge/task-1");

    // Verify ExecutionStarted event was published
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "ExecutionStarted"));

    expect(events.length).toBeGreaterThan(0);
    const event = events[0];
    expect(event.aggregateType).toBe("Execution");
    expect(event.aggregateId).toBe(executionId);
    expect(event.data).toMatchObject({
      executionId,
      taskId,
      branchName: "loopforge/task-1",
    });
  });

  it("should track iteration and extraction events", async () => {
    // Arrange - Start execution
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Complete iteration (iteration is auto-started if not exists)
    await executionService.completeIteration({
      executionId,
      thoughts: ["Analyzing code", "Planning changes"],
      actions: ["Read file", "Edit file"],
    });

    // Assert - IterationCompleted event
    let events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "IterationCompleted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      iteration: 1,
      thoughtCount: 2,
      actionCount: 2,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Record extraction
    const extractionResult: ExtractionResult = {
      files: [
        {
          path: "src/index.ts",
          content: "console.log('hello');",
          language: "typescript",
        },
      ],
      strategy: "strict",
      confidence: 0.95,
      fallbackUsed: false,
    };

    await executionService.recordExtraction({
      executionId,
      result: extractionResult,
    });

    // Assert - FilesExtracted event
    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "FilesExtracted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      fileCount: 1,
      strategy: "strict",
      confidence: 0.95,
    });
  });

  it("should track commits and publish CommitCreated events", async () => {
    // Arrange - Start execution
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Record commit
    const commit: CommitInfo = {
      hash: "abc123",
      message: "feat: add new feature",
      filesChanged: 3,
      linesAdded: 50,
      linesDeleted: 10,
      timestamp: new Date(),
    };

    await executionService.recordCommit({
      executionId,
      commit,
    });

    // Assert - CommitCreated event
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "CommitCreated"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      commitHash: "abc123",
      filesChanged: 3,
      message: "feat: add new feature",
    });

    // Verify commit count updated
    const execution = await executionService.getExecution(executionId);
    expect(execution?.commitCount).toBe(1);
  });

  it("should handle stuck detection and recovery", async () => {
    // Arrange - Start execution
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Detect stuck signal
    const stuckSignal: StuckSignal = {
      type: "consecutive_errors",
      severity: "high",
      details: {
        errorCount: 3,
        lastError: "Syntax error",
      },
      detectedAt: new Date(),
    };

    await executionService.detectStuckSignal({
      executionId,
      signal: stuckSignal,
    });

    // Assert - StuckSignalDetected event
    let events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "StuckSignalDetected"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      signal: "consecutive_errors",
      severity: "high",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Start recovery
    const recoveryAttempt: RecoveryAttempt = {
      tier: 1,
      strategy: "format_guidance",
      startedAt: new Date(),
      succeeded: false,
    };

    await executionService.startRecovery({
      executionId,
      attempt: recoveryAttempt,
      reason: "Consecutive errors detected",
    });

    // Assert - RecoveryStarted event
    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "RecoveryStarted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      tier: 1,
      strategy: "format_guidance",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Complete recovery successfully
    await executionService.completeRecovery({
      executionId,
      succeeded: true,
    });

    // Assert - RecoverySucceeded event
    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "RecoverySucceeded"));

    expect(events.length).toBe(1);
  });

  it("should validate completion and publish CompletionValidated event", async () => {
    // Arrange - Start execution
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Validate completion
    const validationReport: ValidationReport = {
      score: 85,
      passed: true,
      checks: {
        hasMarker: { passed: true, score: 20, weight: 20 },
        hasCommits: { passed: true, score: 20, weight: 20 },
        matchesPlan: { passed: true, score: 25, weight: 30 },
        qualityThreshold: { passed: true, score: 15, weight: 15 },
        testsExecuted: { passed: false, score: 0, weight: 5 },
        noCriticalErrors: { passed: true, score: 10, weight: 10 },
      },
      generatedAt: new Date(),
    };

    await executionService.validateCompletion({
      executionId,
      report: validationReport,
    });

    // Assert - CompletionValidated event
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "CompletionValidated"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      score: 85,
      passed: true,
    });
  });

  it("should complete execution and publish ExecutionCompleted event", async () => {
    // Arrange - Start execution
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Complete execution
    await executionService.completeExecution(executionId);

    // Assert - ExecutionCompleted event
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "ExecutionCompleted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      taskId,
    });

    // Verify execution status
    const execution = await executionService.getExecution(executionId);
    expect(execution?.status).toBe("completed");
    expect(execution?.isComplete).toBe(true);
  });

  it("should fail execution and publish ExecutionFailed event", async () => {
    // Arrange - Start execution
    const { executionId } = await executionService.startExecution({
      taskId,
      branchName: "loopforge/task-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Fail execution
    await executionService.failExecution({
      executionId,
      error: "Max iterations reached",
    });

    // Assert - ExecutionFailed event
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "ExecutionFailed"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      executionId,
      taskId,
      error: "Max iterations reached",
    });

    // Verify execution status
    const execution = await executionService.getExecution(executionId);
    expect(execution?.status).toBe("failed");
    expect(execution?.isComplete).toBe(true);
  });
});
