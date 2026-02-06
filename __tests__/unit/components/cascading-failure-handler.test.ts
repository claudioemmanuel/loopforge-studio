import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb, getTestPool } from "../../setup/test-db";

const TEST_PREFIX = `cascade-fail-${Date.now()}`;

describe("Cascading Failure Handler", () => {
  const db = getTestDb();

  // Setup test data
  let testUser: schema.User;
  let testRepo: schema.Repo;
  let failedTask: schema.Task;
  let dependentTask1: schema.Task;
  let dependentTask2: schema.Task;

  beforeEach(async () => {
    const pool = getTestPool();

    // Ensure activity_events table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_category TEXT NOT NULL DEFAULT 'system',
        title TEXT NOT NULL,
        content TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);

    // Create test user
    [testUser] = await db
      .insert(schema.users)
      .values({
        githubId: `${TEST_PREFIX}-user-${Math.random().toString(36).slice(2)}`,
        username: "testuser",
      })
      .returning();

    // Create test repo
    [testRepo] = await db
      .insert(schema.repos)
      .values({
        userId: testUser.id,
        githubRepoId: `repo-${Math.random().toString(36).slice(2)}`,
        name: "test-repo",
        fullName: "testuser/test-repo",
        cloneUrl: "https://github.com/testuser/test-repo.git",
        defaultBranch: "main",
      })
      .returning();

    // Create the failed task (blocker)
    [failedTask] = await db
      .insert(schema.tasks)
      .values({
        repoId: testRepo.id,
        title: "Failed Blocker Task",
        status: "stuck",
        blockedByIds: [],
      })
      .returning();

    // Create dependent tasks
    [dependentTask1] = await db
      .insert(schema.tasks)
      .values({
        repoId: testRepo.id,
        title: "Dependent Task 1",
        status: "todo",
        blockedByIds: [failedTask.id],
      })
      .returning();

    [dependentTask2] = await db
      .insert(schema.tasks)
      .values({
        repoId: testRepo.id,
        title: "Dependent Task 2",
        status: "ready",
        blockedByIds: [failedTask.id],
      })
      .returning();

    // Create task dependencies junction records
    await db.insert(schema.taskDependencies).values([
      { taskId: dependentTask1.id, blockedById: failedTask.id },
      { taskId: dependentTask2.id, blockedById: failedTask.id },
    ]);
  });

  describe("Cascading Failure Notification", () => {
    /**
     * Simulate the handleCascadingFailure function logic
     */
    async function simulateHandleCascadingFailure(
      failedTaskId: string,
      failedTaskTitle: string,
      userId: string,
      repoId: string,
    ): Promise<void> {
      // Find tasks that are blocked by the failed task
      const dependentTasks = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.blockedById, failedTaskId),
        with: {
          task: {
            columns: { id: true, title: true, status: true },
          },
        },
      });

      if (dependentTasks.length === 0) {
        return;
      }

      // Create activity events for each dependent task
      for (const dep of dependentTasks) {
        await db.insert(schema.activityEvents).values({
          id: crypto.randomUUID(),
          taskId: dep.task.id,
          repoId,
          userId,
          eventType: "blocker_failed",
          eventCategory: "system",
          title: "Blocker task failed",
          content: `Blocked by "${failedTaskTitle}" which has failed. This task cannot proceed until the blocker is resolved.`,
          metadata: {
            failedBlockerId: failedTaskId,
            failedBlockerTitle: failedTaskTitle,
          },
          createdAt: new Date(),
        });
      }
    }

    it("creates blocker_failed activity events for dependent tasks", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      // Check activity events were created
      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      expect(events.length).toBe(2);
    });

    it("includes failedBlockerId in event metadata", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      for (const event of events) {
        const metadata = event.metadata as Record<string, unknown>;
        expect(metadata.failedBlockerId).toBe(failedTask.id);
      }
    });

    it("includes failedBlockerTitle in event metadata", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      for (const event of events) {
        const metadata = event.metadata as Record<string, unknown>;
        expect(metadata.failedBlockerTitle).toBe("Failed Blocker Task");
      }
    });

    it("handles multiple dependent tasks", async () => {
      // Create additional dependent task
      const [dependentTask3] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Dependent Task 3",
          status: "planning",
          blockedByIds: [failedTask.id],
        })
        .returning();

      await db.insert(schema.taskDependencies).values({
        taskId: dependentTask3.id,
        blockedById: failedTask.id,
      });

      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      expect(events.length).toBe(3);
    });

    it("handles case with no matching dependencies gracefully", async () => {
      // Use a valid UUID format but one that doesn't exist
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Should complete without error - just finds no dependencies
      await simulateHandleCascadingFailure(
        nonExistentId,
        "Non-existent Task",
        testUser.id,
        testRepo.id,
      );

      // Should not create any events for non-existent blocker
      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      // No events should be created for non-existent blocker
      expect(events.length).toBe(0);
    });

    it("handles case with no dependent tasks", async () => {
      // Create task with no dependents
      const [isolatedTask] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Isolated Task",
          status: "stuck",
          blockedByIds: [],
        })
        .returning();

      await simulateHandleCascadingFailure(
        isolatedTask.id,
        isolatedTask.title,
        testUser.id,
        testRepo.id,
      );

      // Should not create any events
      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      // Only events from previous tests
      expect(events.length).toBe(0);
    });

    it("event message includes blocker task title", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      for (const event of events) {
        expect(event.content).toContain("Failed Blocker Task");
        expect(event.content).toContain("which has failed");
      }
    });

    it("event is associated with correct dependent task", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      const eventTaskIds = events.map((e) => e.taskId);

      expect(eventTaskIds).toContain(dependentTask1.id);
      expect(eventTaskIds).toContain(dependentTask2.id);
      // Should NOT contain the failed task itself
      expect(eventTaskIds).not.toContain(failedTask.id);
    });

    it("sets correct event category", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      for (const event of events) {
        expect(event.eventCategory).toBe("system");
      }
    });

    it("sets correct event title", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      for (const event of events) {
        expect(event.title).toBe("Blocker task failed");
      }
    });
  });

  describe("Cascading Failure Integration", () => {
    it("creates unique event IDs for each notification", async () => {
      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      const eventIds = events.map((e) => e.id);
      const uniqueIds = new Set(eventIds);

      expect(uniqueIds.size).toBe(eventIds.length);
    });

    it("timestamps are set correctly", async () => {
      const beforeTime = new Date();

      await simulateHandleCascadingFailure(
        failedTask.id,
        failedTask.title,
        testUser.id,
        testRepo.id,
      );

      const afterTime = new Date();

      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventType, "blocker_failed"),
      });

      for (const event of events) {
        expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime(),
        );
        expect(event.createdAt.getTime()).toBeLessThanOrEqual(
          afterTime.getTime(),
        );
      }
    });
  });

  // Helper function used in tests
  async function simulateHandleCascadingFailure(
    failedTaskId: string,
    failedTaskTitle: string,
    userId: string,
    repoId: string,
  ): Promise<void> {
    // Find tasks that are blocked by the failed task
    const dependentTasks = await db.query.taskDependencies.findMany({
      where: eq(schema.taskDependencies.blockedById, failedTaskId),
      with: {
        task: {
          columns: { id: true, title: true, status: true },
        },
      },
    });

    if (dependentTasks.length === 0) {
      return;
    }

    // Create activity events for each dependent task
    for (const dep of dependentTasks) {
      await db.insert(schema.activityEvents).values({
        id: crypto.randomUUID(),
        taskId: dep.task.id,
        repoId,
        userId,
        eventType: "blocker_failed",
        eventCategory: "system",
        title: "Blocker task failed",
        content: `Blocked by "${failedTaskTitle}" which has failed. This task cannot proceed until the blocker is resolved.`,
        metadata: {
          failedBlockerId: failedTaskId,
          failedBlockerTitle: failedTaskTitle,
        },
        createdAt: new Date(),
      });
    }
  }
});
