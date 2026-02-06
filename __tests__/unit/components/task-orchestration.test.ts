import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb, getTestPool } from "../../setup/test-db";

const TEST_PREFIX = `orchestration-${Date.now()}`;

/**
 * Tests for task auto-orchestration logic
 * This tests the business logic of determining when to auto-trigger tasks
 */
describe("Task Orchestration Logic", () => {
  const db = getTestDb();

  beforeEach(async () => {
    const pool = getTestPool();
    await pool.query(`
      -- Ensure dependency columns exist
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by_ids JSONB DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_execute_when_unblocked BOOLEAN DEFAULT false;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency_priority INTEGER DEFAULT 0;

      -- Create task_dependencies table if not exists
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        blocked_by_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        CONSTRAINT task_dependencies_unique UNIQUE(task_id, blocked_by_id)
      );
    `);
  });

  /**
   * Helper function that mirrors the orchestration logic in execution-worker.ts
   * Determines if a task should be auto-triggered
   */
  async function checkShouldAutoTrigger(taskId: string): Promise<{
    shouldTrigger: boolean;
    reason: string;
  }> {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });

    if (!task) {
      return { shouldTrigger: false, reason: "Task not found" };
    }

    // Check if already done or executing
    if (task.status === "done" || task.status === "executing") {
      return { shouldTrigger: false, reason: `Task already ${task.status}` };
    }

    // Check if auto-execute enabled
    if (!task.autoExecuteWhenUnblocked) {
      return { shouldTrigger: false, reason: "Auto-execute not enabled" };
    }

    // Check if all blockers are complete
    const blockers = await db.query.taskDependencies.findMany({
      where: eq(schema.taskDependencies.taskId, taskId),
      with: {
        blockedBy: {
          columns: { status: true, id: true },
        },
      },
    });

    if (blockers.length === 0) {
      return { shouldTrigger: true, reason: "No blockers" };
    }

    const allComplete = blockers.every((b) => b.blockedBy.status === "done");

    if (!allComplete) {
      const incomplete = blockers.filter((b) => b.blockedBy.status !== "done");
      return {
        shouldTrigger: false,
        reason: `${incomplete.length} blocker(s) not complete`,
      };
    }

    return { shouldTrigger: true, reason: "All blockers complete" };
  }

  describe("Auto-trigger conditions", () => {
    it("should not trigger if autoExecuteWhenUnblocked is false", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-1`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-1",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task without auto-execute",
          autoExecuteWhenUnblocked: false,
        })
        .returning();

      const result = await checkShouldAutoTrigger(task.id);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toBe("Auto-execute not enabled");
    });

    it("should not trigger if task is already done", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-done`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-done",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Already done task",
          status: "done",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      const result = await checkShouldAutoTrigger(task.id);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toBe("Task already done");
    });

    it("should not trigger if task is already executing", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-exec`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-exec",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Executing task",
          status: "executing",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      const result = await checkShouldAutoTrigger(task.id);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toBe("Task already executing");
    });

    it("should trigger if no blockers and auto-execute enabled", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-no-blockers`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-no-blockers",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task with no blockers",
          status: "ready",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      const result = await checkShouldAutoTrigger(task.id);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toBe("No blockers");
    });

    it("should not trigger if some blockers are incomplete", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-incomplete`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-incomplete",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [blocker1] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Complete blocker",
          status: "done",
        })
        .returning();

      const [blocker2] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Incomplete blocker",
          status: "executing",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task with mixed blockers",
          status: "todo",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      // Add dependencies
      await db.insert(schema.taskDependencies).values([
        { taskId: task.id, blockedById: blocker1.id },
        { taskId: task.id, blockedById: blocker2.id },
      ]);

      const result = await checkShouldAutoTrigger(task.id);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain("blocker(s) not complete");
    });

    it("should trigger when all blockers are done", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-all-done`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-all-done",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const blockers = await db
        .insert(schema.tasks)
        .values([
          { repoId: repo.id, title: "Blocker 1", status: "done" },
          { repoId: repo.id, title: "Blocker 2", status: "done" },
          { repoId: repo.id, title: "Blocker 3", status: "done" },
        ])
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task ready to trigger",
          status: "ready",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      // Add dependencies
      for (const blocker of blockers) {
        await db.insert(schema.taskDependencies).values({
          taskId: task.id,
          blockedById: blocker.id,
        });
      }

      const result = await checkShouldAutoTrigger(task.id);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toBe("All blockers complete");
    });
  });

  describe("Cascade trigger scenarios", () => {
    it("should identify tasks to trigger when a blocker completes", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-cascade`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-cascade",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      // Create a blocker task
      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Common blocker",
          status: "executing",
        })
        .returning();

      // Create tasks that depend on it
      const dependentTasks = await db
        .insert(schema.tasks)
        .values([
          {
            repoId: repo.id,
            title: "Dependent 1",
            autoExecuteWhenUnblocked: true,
          },
          {
            repoId: repo.id,
            title: "Dependent 2",
            autoExecuteWhenUnblocked: true,
          },
          {
            repoId: repo.id,
            title: "Dependent 3",
            autoExecuteWhenUnblocked: false,
          }, // Won't trigger
        ])
        .returning();

      // Add dependencies
      for (const task of dependentTasks) {
        await db.insert(schema.taskDependencies).values({
          taskId: task.id,
          blockedById: blocker.id,
        });
      }

      // Simulate blocker completing
      await db
        .update(schema.tasks)
        .set({ status: "done" })
        .where(eq(schema.tasks.id, blocker.id));

      // Find tasks that should be triggered
      const dependents = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.blockedById, blocker.id),
      });

      const tasksToTrigger = [];
      for (const dep of dependents) {
        const result = await checkShouldAutoTrigger(dep.taskId);
        if (result.shouldTrigger) {
          tasksToTrigger.push(dep.taskId);
        }
      }

      // Should have 2 tasks to trigger (the ones with autoExecuteWhenUnblocked: true)
      expect(tasksToTrigger).toHaveLength(2);
    });

    it("should handle chain dependencies correctly", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-chain`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-chain",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      // Create chain: A -> B -> C
      const [taskA] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task A (first)",
          status: "done",
        })
        .returning();

      const [taskB] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task B (middle)",
          status: "todo",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      const [taskC] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task C (last)",
          status: "todo",
          autoExecuteWhenUnblocked: true,
        })
        .returning();

      // B depends on A
      await db.insert(schema.taskDependencies).values({
        taskId: taskB.id,
        blockedById: taskA.id,
      });

      // C depends on B
      await db.insert(schema.taskDependencies).values({
        taskId: taskC.id,
        blockedById: taskB.id,
      });

      // Task A is done, so B should trigger
      const resultB = await checkShouldAutoTrigger(taskB.id);
      expect(resultB.shouldTrigger).toBe(true);

      // Task B is NOT done, so C should NOT trigger yet
      const resultC = await checkShouldAutoTrigger(taskC.id);
      expect(resultC.shouldTrigger).toBe(false);
      expect(resultC.reason).toContain("blocker(s) not complete");

      // Complete B
      await db
        .update(schema.tasks)
        .set({ status: "done" })
        .where(eq(schema.tasks.id, taskB.id));

      // Now C should trigger
      const resultC2 = await checkShouldAutoTrigger(taskC.id);
      expect(resultC2.shouldTrigger).toBe(true);
    });
  });

  describe("Priority ordering", () => {
    it("should respect dependency priority for ordering", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-priority`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-priority",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocker",
          status: "done",
        })
        .returning();

      // Create tasks with different priorities
      const tasksToCreate = [
        {
          repoId: repo.id,
          title: "Low priority",
          dependencyPriority: 1,
          autoExecuteWhenUnblocked: true,
        },
        {
          repoId: repo.id,
          title: "High priority",
          dependencyPriority: 10,
          autoExecuteWhenUnblocked: true,
        },
        {
          repoId: repo.id,
          title: "Medium priority",
          dependencyPriority: 5,
          autoExecuteWhenUnblocked: true,
        },
      ];

      const tasks = await db
        .insert(schema.tasks)
        .values(tasksToCreate)
        .returning();

      // Add dependencies
      for (const task of tasks) {
        await db.insert(schema.taskDependencies).values({
          taskId: task.id,
          blockedById: blocker.id,
        });
      }

      // Get dependent tasks ordered by priority
      const dependents = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.blockedById, blocker.id),
        with: {
          task: true,
        },
      });

      const sortedByPriority = dependents
        .map((d) => d.task)
        .sort(
          (a, b) => (b.dependencyPriority ?? 0) - (a.dependencyPriority ?? 0),
        );

      expect(sortedByPriority[0].title).toBe("High priority");
      expect(sortedByPriority[1].title).toBe("Medium priority");
      expect(sortedByPriority[2].title).toBe("Low priority");
    });
  });
});
