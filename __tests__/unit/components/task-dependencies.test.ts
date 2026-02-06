import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb, getTestPool } from "../../setup/test-db";

const TEST_PREFIX = `task-deps-${Date.now()}`;

describe("Task Dependencies Schema", () => {
  const db = getTestDb();

  // Ensure the task_dependencies table exists
  beforeEach(async () => {
    const pool = getTestPool();
    await pool.query(`
      -- Add dependency columns to tasks if not exists
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by_ids JSONB DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_execute_when_unblocked BOOLEAN DEFAULT false;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency_priority INTEGER DEFAULT 0;

      -- Create task_dependencies junction table if not exists
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        blocked_by_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        CONSTRAINT task_dependencies_unique UNIQUE(task_id, blocked_by_id)
      );
    `);
  });

  describe("Task Dependency Columns", () => {
    it("should create a task with dependency fields", async () => {
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
          githubRepoId: "repo-12345",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Test task with dependencies",
          blockedByIds: [],
          autoExecuteWhenUnblocked: true,
          dependencyPriority: 5,
        })
        .returning();

      expect(task).toBeDefined();
      expect(task.blockedByIds).toEqual([]);
      expect(task.autoExecuteWhenUnblocked).toBe(true);
      expect(task.dependencyPriority).toBe(5);
    });

    it("should default autoExecuteWhenUnblocked to false", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-defaults`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-54321",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Task with default settings",
        })
        .returning();

      expect(task.autoExecuteWhenUnblocked).toBe(false);
      expect(task.dependencyPriority).toBe(0);
    });

    it("should update blockedByIds array", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-update`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-update",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [task1] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocker task",
        })
        .returning();

      const [task2] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked task",
          blockedByIds: [],
        })
        .returning();

      // Update blockedByIds
      await db
        .update(schema.tasks)
        .set({ blockedByIds: [task1.id] })
        .where(eq(schema.tasks.id, task2.id));

      const [updated] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, task2.id));

      expect(updated.blockedByIds).toContain(task1.id);
    });
  });

  describe("Task Dependencies Junction Table", () => {
    it("should create a dependency relationship", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-junction`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-junction",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocker task",
        })
        .returning();

      const [blocked] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked task",
        })
        .returning();

      // Create dependency
      const [dependency] = await db
        .insert(schema.taskDependencies)
        .values({
          taskId: blocked.id,
          blockedById: blocker.id,
        })
        .returning();

      expect(dependency).toBeDefined();
      expect(dependency.taskId).toBe(blocked.id);
      expect(dependency.blockedById).toBe(blocker.id);
    });

    it("should enforce unique constraint on task-blocker pairs", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-unique`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-unique",
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
        })
        .returning();

      const [blocked] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked",
        })
        .returning();

      // First insert should succeed
      await db.insert(schema.taskDependencies).values({
        taskId: blocked.id,
        blockedById: blocker.id,
      });

      // Second insert with same pair should fail
      await expect(
        db.insert(schema.taskDependencies).values({
          taskId: blocked.id,
          blockedById: blocker.id,
        }),
      ).rejects.toThrow();
    });

    it("should cascade delete when task is deleted", async () => {
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

      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocker",
        })
        .returning();

      const [blocked] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked",
        })
        .returning();

      await db.insert(schema.taskDependencies).values({
        taskId: blocked.id,
        blockedById: blocker.id,
      });

      // Delete the blocker task
      await db.delete(schema.tasks).where(eq(schema.tasks.id, blocker.id));

      // Dependency should be gone
      const deps = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.blockedById, blocker.id),
      });

      expect(deps).toHaveLength(0);
    });

    it("should support multiple blockers for one task", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-multi`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-multi",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const blockers = await db
        .insert(schema.tasks)
        .values([
          { repoId: repo.id, title: "Blocker 1" },
          { repoId: repo.id, title: "Blocker 2" },
          { repoId: repo.id, title: "Blocker 3" },
        ])
        .returning();

      const [blocked] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked task",
        })
        .returning();

      // Create dependencies for all blockers
      for (const blocker of blockers) {
        await db.insert(schema.taskDependencies).values({
          taskId: blocked.id,
          blockedById: blocker.id,
        });
      }

      // Query dependencies
      const deps = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.taskId, blocked.id),
      });

      expect(deps).toHaveLength(3);
    });

    it("should support one task blocking multiple tasks", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-blocks-many`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-blocks-many",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Common blocker",
        })
        .returning();

      const blockedTasks = await db
        .insert(schema.tasks)
        .values([
          { repoId: repo.id, title: "Blocked 1" },
          { repoId: repo.id, title: "Blocked 2" },
          { repoId: repo.id, title: "Blocked 3" },
        ])
        .returning();

      // Create dependencies
      for (const blocked of blockedTasks) {
        await db.insert(schema.taskDependencies).values({
          taskId: blocked.id,
          blockedById: blocker.id,
        });
      }

      // Query tasks blocked by the blocker
      const deps = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.blockedById, blocker.id),
      });

      expect(deps).toHaveLength(3);
    });
  });

  describe("Task Dependency Relations", () => {
    it("should query dependencies with task info via join", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-relations`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-relations",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocker task",
          status: "done",
        })
        .returning();

      const [blocked] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked task",
          status: "todo",
        })
        .returning();

      await db.insert(schema.taskDependencies).values({
        taskId: blocked.id,
        blockedById: blocker.id,
      });

      // Query dependencies for a task
      const deps = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.taskId, blocked.id),
      });

      expect(deps).toHaveLength(1);
      expect(deps[0].blockedById).toBe(blocker.id);

      // Get the blocker task separately
      const blockerTask = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, deps[0].blockedById),
      });

      expect(blockerTask).toBeDefined();
      expect(blockerTask?.status).toBe("done");
    });

    it("should query tasks blocked by a specific task", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-blocks-rel`,
          username: "testuser",
        })
        .returning();

      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-blocks-rel",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      const [blocker] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocker task",
        })
        .returning();

      const [blocked] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Blocked task",
        })
        .returning();

      await db.insert(schema.taskDependencies).values({
        taskId: blocked.id,
        blockedById: blocker.id,
      });

      // Query what tasks the blocker blocks
      const blockedTaskDeps = await db.query.taskDependencies.findMany({
        where: eq(schema.taskDependencies.blockedById, blocker.id),
      });

      expect(blockedTaskDeps).toHaveLength(1);
      expect(blockedTaskDeps[0].taskId).toBe(blocked.id);

      // Get the blocked task details
      const blockedTask = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, blockedTaskDeps[0].taskId),
      });

      expect(blockedTask).toBeDefined();
      expect(blockedTask?.title).toBe("Blocked task");
    });
  });
});
