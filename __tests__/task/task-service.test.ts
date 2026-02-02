/**
 * Task Service Integration Tests
 *
 * Tests task lifecycle, state transitions, and dependency management.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users, repos, domainEvents } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import { TaskService } from "@/lib/contexts/task/application/task-service";
import type { TaskMetadata } from "@/lib/contexts/task/domain/types";
import { randomUUID } from "crypto";

describe("Task Service", () => {
  let redis: Redis;
  let taskService: TaskService;
  let userId: string;
  let repositoryId: string;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    taskService = new TaskService(redis);
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
  });

  afterAll(async () => {
    await db.delete(domainEvents);
    await db.delete(users);
    await redis.quit();
  });

  it("should create task and publish TaskCreated event", async () => {
    // Arrange
    const metadata: TaskMetadata = {
      title: "Test Task",
      description: "Test description",
      priority: 1,
    };

    // Act
    const { taskId } = await taskService.createTask({
      repositoryId,
      metadata,
      configuration: {
        autonomousMode: true,
      },
    });

    // Assert
    expect(taskId).toBeDefined();

    // Verify task was created
    const task = await taskService.getTask(taskId);
    expect(task).not.toBeNull();
    expect(task?.title).toBe("Test Task");
    expect(task?.status).toBe("todo");
    expect(task?.priority).toBe(1);

    // Verify TaskCreated event was published
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "TaskCreated"));

    expect(events.length).toBeGreaterThan(0);
    const event = events[0];
    expect(event.aggregateType).toBe("Task");
    expect(event.aggregateId).toBe(taskId);
    expect(event.data).toMatchObject({
      taskId,
      repositoryId,
      title: "Test Task",
      priority: 1,
      autonomousMode: true,
    });
  });

  it("should handle full task lifecycle with events", async () => {
    // Arrange - Create task
    const metadata: TaskMetadata = {
      title: "Lifecycle Test",
      priority: 0,
    };

    const { taskId } = await taskService.createTask({
      repositoryId,
      metadata,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act & Assert - Brainstorm phase
    await taskService.startBrainstorm({
      taskId,
      jobId: "brainstorm-job-1",
    });

    let events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "BrainstormingStarted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      taskId,
      jobId: "brainstorm-job-1",
    });

    // Complete brainstorm
    await db.delete(domainEvents);
    await taskService.completeBrainstorm({
      taskId,
      result: {
        summary: "Brainstorm summary",
        conversation: [
          {
            role: "user",
            content: "Let's discuss",
            timestamp: new Date(),
          },
        ],
        messageCount: 1,
      },
    });

    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "BrainstormingCompleted"));

    expect(events.length).toBe(1);

    // Act & Assert - Planning phase
    await db.delete(domainEvents);
    await taskService.startPlanning({
      taskId,
      jobId: "plan-job-1",
    });

    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "PlanningStarted"));

    expect(events.length).toBe(1);

    // Complete planning
    await db.delete(domainEvents);
    await taskService.completePlanning({
      taskId,
      planContent: "# Plan\n1. Do this\n2. Do that",
    });

    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "PlanningCompleted"));

    expect(events.length).toBe(1);

    // Verify status is now "ready"
    let task = await taskService.getTask(taskId);
    expect(task?.status).toBe("ready");
    expect(task?.canExecute).toBe(true);

    // Act & Assert - Execution phase
    await db.delete(domainEvents);
    await taskService.startExecution({
      taskId,
      executionId: "exec-1",
      branchName: "loopforge/task-1",
    });

    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "ExecutionStarted"));

    expect(events.length).toBe(1);

    // Complete execution
    await db.delete(domainEvents);
    await taskService.completeExecution({
      taskId,
      result: {
        executionId: "exec-1",
        branchName: "loopforge/task-1",
        commitCount: 3,
        prUrl: "https://github.com/test/repo/pull/1",
        prNumber: 1,
      },
    });

    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "ExecutionCompleted"));

    expect(events.length).toBe(1);

    // Verify status is now "review" (because PR was created)
    task = await taskService.getTask(taskId);
    expect(task?.status).toBe("review");
  });

  it("should handle task dependencies and blocking", async () => {
    // Arrange - Create two tasks
    const task1Metadata: TaskMetadata = {
      title: "Task 1 (Blocker)",
      priority: 1,
    };

    const task2Metadata: TaskMetadata = {
      title: "Task 2 (Blocked)",
      priority: 0,
    };

    const { taskId: task1Id } = await taskService.createTask({
      repositoryId,
      metadata: task1Metadata,
    });

    const { taskId: task2Id } = await taskService.createTask({
      repositoryId,
      metadata: task2Metadata,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Add dependency (task2 is blocked by task1)
    await taskService.addDependency({
      taskId: task2Id,
      blockedById: task1Id,
    });

    // Assert - DependencyAdded event
    let events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "DependencyAdded"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      taskId: task2Id,
      blockedById: task1Id,
    });

    // Verify task2 is blocked
    let task2 = await taskService.getTask(task2Id);
    expect(task2?.isBlocked).toBe(true);
    expect(task2?.canExecute).toBe(false);

    // Act - Advance task2 to ready status (but still blocked)
    await taskService.startBrainstorm({
      taskId: task2Id,
      jobId: "brainstorm-job",
    });
    await taskService.completeBrainstorm({
      taskId: task2Id,
      result: {
        summary: "Summary",
        conversation: [],
        messageCount: 0,
      },
    });
    await taskService.startPlanning({
      taskId: task2Id,
      jobId: "plan-job",
    });
    await taskService.completePlanning({
      taskId: task2Id,
      planContent: "Plan",
    });

    // Verify task2 is ready but blocked
    task2 = await taskService.getTask(task2Id);
    expect(task2?.status).toBe("ready");
    expect(task2?.canExecute).toBe(false); // Still blocked!

    // Act - Try to execute task2 (should fail)
    await expect(
      taskService.startExecution({
        taskId: task2Id,
        executionId: "exec-1",
        branchName: "branch-1",
      }),
    ).rejects.toThrow("blocked");

    // Act - Complete task1 (unblocks task2)
    // Fast-forward task1 to done
    await taskService.startBrainstorm({
      taskId: task1Id,
      jobId: "brainstorm-job",
    });
    await taskService.completeBrainstorm({
      taskId: task1Id,
      result: {
        summary: "Summary",
        conversation: [],
        messageCount: 0,
      },
    });
    await taskService.startPlanning({
      taskId: task1Id,
      jobId: "plan-job",
    });
    await taskService.completePlanning({
      taskId: task1Id,
      planContent: "Plan",
    });
    await taskService.startExecution({
      taskId: task1Id,
      executionId: "exec-1",
      branchName: "branch-1",
    });

    await db.delete(domainEvents);
    await taskService.completeExecution({
      taskId: task1Id,
      result: {
        executionId: "exec-1",
        branchName: "branch-1",
        commitCount: 1,
      },
    });

    // Assert - TaskUnblocked event for task2
    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "TaskUnblocked"));

    expect(events.length).toBe(1);
    expect(events[0].aggregateId).toBe(task2Id);

    // Verify task2 is now unblocked and can execute
    task2 = await taskService.getTask(task2Id);
    expect(task2?.isBlocked).toBe(false);
    expect(task2?.canExecute).toBe(true);
  });

  it("should handle stuck tasks", async () => {
    // Arrange - Create task
    const metadata: TaskMetadata = {
      title: "Stuck Task",
      priority: 0,
    };

    const { taskId } = await taskService.createTask({
      repositoryId,
      metadata,
    });

    // Advance to executing
    await taskService.startBrainstorm({
      taskId,
      jobId: "job-1",
    });
    await taskService.completeBrainstorm({
      taskId,
      result: {
        summary: "Summary",
        conversation: [],
        messageCount: 0,
      },
    });
    await taskService.startPlanning({
      taskId,
      jobId: "job-2",
    });
    await taskService.completePlanning({
      taskId,
      planContent: "Plan",
    });
    await taskService.startExecution({
      taskId,
      executionId: "exec-1",
      branchName: "branch-1",
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Fail execution
    await taskService.failExecution({
      taskId,
      executionId: "exec-1",
      error: "Something went wrong",
    });

    // Assert - ExecutionFailed event
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "ExecutionFailed"));

    expect(events.length).toBe(1);

    // Assert - TaskStuck status
    const task = await taskService.getTask(taskId);
    expect(task?.status).toBe("stuck");
  });
});
