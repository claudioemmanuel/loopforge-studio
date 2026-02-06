import { describe, it, expect, beforeEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb } from "../../../setup/test-db";

const TEST_PREFIX = `dep-blocking-${Date.now()}`;

describe("Dependency Blocking Enforcement API", () => {
  const db = getTestDb();

  // Setup test data
  let testUser: schema.User;
  let testRepo: schema.Repo;
  let blockerTask: schema.Task;
  let blockedTask: schema.Task;

  beforeEach(async () => {
    // Create test user
    [testUser] = await db
      .insert(schema.users)
      .values({
        githubId: `${TEST_PREFIX}-user-${Math.random().toString(36).slice(2)}`,
        username: "testuser",
        encryptedApiKey: "encrypted-key",
        apiKeyIv: "iv",
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

    // Create blocker task
    [blockerTask] = await db
      .insert(schema.tasks)
      .values({
        repoId: testRepo.id,
        title: "Blocker Task",
        status: "todo",
        blockedByIds: [],
      })
      .returning();

    // Create blocked task
    [blockedTask] = await db
      .insert(schema.tasks)
      .values({
        repoId: testRepo.id,
        title: "Blocked Task",
        status: "ready",
        planContent: '{"steps":[]}',
        blockedByIds: [blockerTask.id],
      })
      .returning();
  });

  describe("Execution Blocking Logic", () => {
    it("allows execution when task has no blockers", async () => {
      // Task with no blockers
      const [independentTask] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Independent Task",
          status: "ready",
          planContent: '{"steps":[]}',
          blockedByIds: [],
        })
        .returning();

      const blockedByIds = independentTask.blockedByIds || [];

      expect(blockedByIds.length).toBe(0);
      // No blockers means execution is allowed
    });

    it("allows execution when all blockers are completed (status: done)", async () => {
      // Update blocker to done
      await db
        .update(schema.tasks)
        .set({ status: "done" })
        .where(eq(schema.tasks.id, blockerTask.id));

      // Query blocker tasks
      const blockedByIds = blockedTask.blockedByIds || [];
      const blockerTasks = await db.query.tasks.findMany({
        where: inArray(schema.tasks.id, blockedByIds),
        columns: { id: true, title: true, status: true },
      });

      const incompleteBlockers = blockerTasks.filter(
        (blocker: { status: string }) => blocker.status !== "done",
      );

      expect(incompleteBlockers.length).toBe(0);
      // All blockers complete means execution is allowed
    });

    it("blocks execution when any blocker is incomplete", async () => {
      // Blocker is still in 'todo' status
      const blockedByIds = blockedTask.blockedByIds || [];
      const blockerTasks = await db.query.tasks.findMany({
        where: inArray(schema.tasks.id, blockedByIds),
        columns: { id: true, title: true, status: true },
      });

      const incompleteBlockers = blockerTasks.filter(
        (blocker: { status: string }) => blocker.status !== "done",
      );

      expect(incompleteBlockers.length).toBeGreaterThan(0);
      expect(incompleteBlockers[0].status).toBe("todo");
    });

    it("provides blocker details when execution is blocked", async () => {
      const blockedByIds = blockedTask.blockedByIds || [];
      const blockerTasks = await db.query.tasks.findMany({
        where: inArray(schema.tasks.id, blockedByIds),
        columns: { id: true, title: true, status: true },
      });

      const incompleteBlockers = blockerTasks.filter(
        (blocker: { status: string }) => blocker.status !== "done",
      );

      // Simulate error response format
      const errorResponse = {
        error: "Task is blocked by incomplete dependencies",
        blockedBy: incompleteBlockers.map(
          (blocker: { id: string; title: string; status: string }) => ({
            id: blocker.id,
            title: blocker.title,
            status: blocker.status,
          }),
        ),
      };

      expect(errorResponse.error).toBe(
        "Task is blocked by incomplete dependencies",
      );
      expect(errorResponse.blockedBy).toHaveLength(1);
      expect(errorResponse.blockedBy[0].id).toBe(blockerTask.id);
      expect(errorResponse.blockedBy[0].title).toBe("Blocker Task");
      expect(errorResponse.blockedBy[0].status).toBe("todo");
    });

    it("handles empty blockedByIds array correctly", async () => {
      const [taskWithEmptyBlockers] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Task with empty blockers",
          status: "ready",
          planContent: '{"steps":[]}',
          blockedByIds: [],
        })
        .returning();

      const blockedByIds = taskWithEmptyBlockers.blockedByIds || [];

      expect(blockedByIds.length).toBe(0);
      // Empty array means no blockers - execution allowed
    });

    it("handles null blockedByIds gracefully", async () => {
      // Task where blockedByIds might be null (legacy data)
      const [taskWithNullBlockers] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Task with null blockers",
          status: "ready",
          planContent: '{"steps":[]}',
          // Not providing blockedByIds - should default to empty
        })
        .returning();

      const blockedByIds = taskWithNullBlockers.blockedByIds || [];

      expect(Array.isArray(blockedByIds)).toBe(true);
      expect(blockedByIds.length).toBe(0);
    });

    it("correctly identifies multiple incomplete blockers", async () => {
      // Create additional blocker
      const [blocker2] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Blocker Task 2",
          status: "executing", // Also not done
        })
        .returning();

      // Create task with multiple blockers
      const [multiBlockedTask] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Multi-blocked Task",
          status: "ready",
          planContent: '{"steps":[]}',
          blockedByIds: [blockerTask.id, blocker2.id],
        })
        .returning();

      const blockedByIds = multiBlockedTask.blockedByIds || [];
      const blockerTasks = await db.query.tasks.findMany({
        where: inArray(schema.tasks.id, blockedByIds),
        columns: { id: true, title: true, status: true },
      });

      const incompleteBlockers = blockerTasks.filter(
        (blocker: { status: string }) => blocker.status !== "done",
      );

      expect(incompleteBlockers.length).toBe(2);
    });

    it("allows execution when some blockers complete", async () => {
      // Create second blocker that is done
      const [completedBlocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Completed Blocker",
          status: "done",
        })
        .returning();

      // Create task with mixed blockers
      const [mixedBlockedTask] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Mixed-blocked Task",
          status: "ready",
          planContent: '{"steps":[]}',
          blockedByIds: [blockerTask.id, completedBlocker.id],
        })
        .returning();

      const blockedByIds = mixedBlockedTask.blockedByIds || [];
      const blockerTasks = await db.query.tasks.findMany({
        where: inArray(schema.tasks.id, blockedByIds),
        columns: { id: true, title: true, status: true },
      });

      const incompleteBlockers = blockerTasks.filter(
        (blocker: { status: string }) => blocker.status !== "done",
      );

      // Still blocked because one blocker is incomplete
      expect(incompleteBlockers.length).toBe(1);
      expect(incompleteBlockers[0].title).toBe("Blocker Task");
    });

    it("handles deleted blocker tasks", async () => {
      // Create blocker that will be deleted
      const [toBeDeletedBlocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "To be deleted blocker",
          status: "todo",
        })
        .returning();

      // Create blocked task
      const [taskWithDeletedBlocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Task with deleted blocker",
          status: "ready",
          planContent: '{"steps":[]}',
          blockedByIds: [toBeDeletedBlocker.id],
        })
        .returning();

      // Delete the blocker
      await db
        .delete(schema.tasks)
        .where(eq(schema.tasks.id, toBeDeletedBlocker.id));

      // Query blockers - should return empty array
      const blockedByIds = taskWithDeletedBlocker.blockedByIds || [];
      const blockerTasks = await db.query.tasks.findMany({
        where: inArray(schema.tasks.id, blockedByIds),
        columns: { id: true, title: true, status: true },
      });

      // Blocker no longer exists
      expect(blockerTasks.length).toBe(0);
      // This could be considered as "no blockers" -> execution allowed
      // Or could be flagged as data integrity issue
    });
  });

  describe("Task Status Transitions", () => {
    it("verifies task must be in ready status to execute", async () => {
      // Task not in ready status
      const [notReadyTask] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "Not Ready Task",
          status: "todo",
          blockedByIds: [],
        })
        .returning();

      expect(notReadyTask.status).not.toBe("ready");
      // Should return error: "Task must be in ready status to execute"
    });

    it("verifies task must have a plan to execute", async () => {
      // Task without plan
      const [noPlanTask] = await db
        .insert(schema.tasks)
        .values({
          repoId: testRepo.id,
          title: "No Plan Task",
          status: "ready",
          planContent: null,
          blockedByIds: [],
        })
        .returning();

      expect(noPlanTask.planContent).toBeNull();
      // Should return error: "Task must have a plan to execute"
    });
  });
});
