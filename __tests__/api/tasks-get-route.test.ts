/**
 * Integration tests for task retrieval through TaskService.getTaskFull.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { getTestPool } from "../setup/test-db";
import { TaskService } from "@/lib/contexts/task/application/task-service";
import { getRedis } from "@/lib/queue";

describe("GET /api/tasks/[taskId] - DDD Migration", () => {
  let testUserId: string;
  let testRepoId: string;
  let testTaskId: string;

  beforeEach(async () => {
    const pool = getTestPool();
    const unique = `${Date.now()}-${Math.random()}`;

    const userResult = await pool.query(
      `INSERT INTO users (id, github_id, username, email)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING id`,
      [`test-github-${unique}`, `testuser-${unique}`, `test-${unique}@ex.com`],
    );
    testUserId = userResult.rows[0].id as string;

    const repoResult = await pool.query(
      `INSERT INTO repos (id, user_id, github_repo_id, full_name, name, clone_url, default_branch)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        testUserId,
        `test-repo-${unique}`,
        `testuser-${unique}/testrepo`,
        "testrepo",
        "https://github.com/testuser/testrepo.git",
        "main",
      ],
    );
    testRepoId = repoResult.rows[0].id as string;

    const taskResult = await pool.query(
      `INSERT INTO tasks (id, repo_id, title, description, autonomous_mode, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING id`,
      [
        testRepoId,
        "Test Task for GET Route",
        "Testing DDD migration",
        true,
        "todo",
      ],
    );
    testTaskId = taskResult.rows[0].id as string;
  });

  describe("Basic task retrieval", () => {
    it("should return task using TaskService.getTaskFull", async () => {
      const taskService = new TaskService(getRedis());
      const task = await taskService.getTaskFull(testTaskId);

      expect(task).toBeDefined();
      expect(task).toMatchObject({
        id: testTaskId,
        repoId: testRepoId,
        title: "Test Task for GET Route",
        description: "Testing DDD migration",
        status: "todo",
        autonomousMode: true,
        repo: { userId: testUserId },
      });

      expect(task?.processingPhase).toBeNull();
      expect(task?.brainstormResult).toBeNull();
      expect(task?.planContent).toBeNull();
      expect(task?.branch).toBeNull();
    });

    it("should return null for non-existent task", async () => {
      const taskService = new TaskService(getRedis());
      const task = await taskService.getTaskFull(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(task).toBeNull();
    });

    it("should include required fields in response", async () => {
      const taskService = new TaskService(getRedis());
      const task = await taskService.getTaskFull(testTaskId);

      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("repoId");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("description");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("priority");
      expect(task).toHaveProperty("autonomousMode");
      expect(task).toHaveProperty("statusHistory");
      expect(task).toHaveProperty("createdAt");
      expect(task).toHaveProperty("updatedAt");
      expect(task).toHaveProperty("repo");
    });
  });

  describe("Task with execution data", () => {
    it("should include brainstorm result when present", async () => {
      const taskService = new TaskService(getRedis());

      await taskService.updateFields(testTaskId, {
        brainstormResult: '{"summary":"Detailed task analysis"}',
      });

      const task = await taskService.getTaskFull(testTaskId);
      expect(task?.brainstormResult).toContain("Detailed task analysis");
    });

    it("should include plan content when task is planned", async () => {
      const taskService = new TaskService(getRedis());

      await taskService.updateFields(testTaskId, {
        planContent: "# Implementation Plan\n\n1. Step 1\n2. Step 2",
      });

      const task = await taskService.getTaskFull(testTaskId);
      expect(task?.planContent).toContain("Implementation Plan");
    });
  });

  describe("TaskAdapter integration", () => {
    it("should properly return flattened persisted state", async () => {
      const taskService = new TaskService(getRedis());
      const pool = getTestPool();

      await taskService.updateFields(testTaskId, {
        status: "executing",
      });

      await pool.query(
        `UPDATE tasks
         SET branch = $1, processing_phase = $2, updated_at = NOW()
         WHERE id = $3`,
        ["loopforge/test-123", "executing", testTaskId],
      );

      const task = await taskService.getTaskFull(testTaskId);
      expect(task?.status).toBe("executing");
      expect(task?.processingPhase).toBe("executing");
      expect(task?.branch).toBe("loopforge/test-123");
      expect(Array.isArray(task?.statusHistory)).toBe(true);
    });

    it("should handle null values correctly", async () => {
      const taskService = new TaskService(getRedis());
      const task = await taskService.getTaskFull(testTaskId);

      expect(task?.description).toBe("Testing DDD migration");
      expect(task?.processingPhase).toBeNull();
      expect(task?.brainstormResult).toBeNull();
      expect(task?.planContent).toBeNull();
      expect(task?.branch).toBeNull();
      expect(task?.executionGraph).toBeNull();
    });
  });

  describe("No direct DB calls validation", () => {
    it("should return repo ownership context with task data", async () => {
      const taskService = new TaskService(getRedis());
      const task = await taskService.getTaskFull(testTaskId);

      expect(task?.id).toBe(testTaskId);
      expect(task?.repoId).toBe(testRepoId);
      expect(task?.repo.userId).toBe(testUserId);
      expect(task).toBeDefined();
    });
  });
});
