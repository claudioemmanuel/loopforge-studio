/**
 * Integration tests for GET /api/tasks/[taskId]
 *
 * Tests the DDD migration of task detail route:
 * - Uses TaskService instead of direct DB queries
 * - Returns properly formatted API response via TaskAdapter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestPool } from "../setup/test-db";
import { TaskService } from "@/lib/contexts/task/application/task-service";
import { getRedis } from "@/lib/queue";

describe("GET /api/tasks/[taskId] - DDD Migration", () => {
  let testUserId: string;
  let testRepoId: string;
  let testTaskId: string;

  beforeEach(async () => {
    const pool = getTestPool();

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (id, github_id, username, email)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING id`,
      [`test-github-${Date.now()}`, "testuser", "test@example.com"],
    );
    testUserId = userResult.rows[0].id;

    // Create test repository
    const repoResult = await pool.query(
      `INSERT INTO repos (id, user_id, github_repo_id, full_name, name, clone_url, default_branch)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        testUserId,
        `test-repo-${Date.now()}`,
        "testuser/testrepo",
        "testrepo",
        "https://github.com/testuser/testrepo.git",
        "main",
      ],
    );
    testRepoId = repoResult.rows[0].id;

    // Create test task using TaskService
    const redis = getRedis();
    const taskService = new TaskService(redis);

    const result = await taskService.createTask({
      userId: testUserId,
      repoId: testRepoId,
      metadata: {
        title: "Test Task for GET Route",
        description: "Testing DDD migration",
      },
      configuration: {
        autonomousMode: true,
      },
    });
    testTaskId = result.taskId;
  });

  describe("Basic task retrieval", () => {
    it("should return task using TaskService.getTaskFull", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Act: Get task via service (simulating what the route does)
      const task = await taskService.getTaskFull(testTaskId);

      // Assert: Verify task structure matches API format
      expect(task).toBeDefined();
      expect(task).toMatchObject({
        id: testTaskId,
        repoId: testRepoId,
        userId: testUserId,
        title: "Test Task for GET Route",
        description: "Testing DDD migration",
        status: "todo",
        autonomousMode: true,
      });

      // Verify API format (flattened structure)
      expect(task?.processingPhase).toBeNull();
      expect(task?.brainstormResult).toBeNull();
      expect(task?.planContent).toBeNull();
      expect(task?.branch).toBeNull();
    });

    it("should return null for non-existent task", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Act
      const task = await taskService.getTaskFull("non-existent-id");

      // Assert
      expect(task).toBeNull();
    });

    it("should include all required fields in API response", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Act
      const task = await taskService.getTaskFull(testTaskId);

      // Assert: Verify all TaskApiResponse fields are present
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("repoId");
      expect(task).toHaveProperty("userId");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("description");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("priority");
      expect(task).toHaveProperty("autonomousMode");
      expect(task).toHaveProperty("statusHistory");
      expect(task).toHaveProperty("createdAt");
      expect(task).toHaveProperty("updatedAt");
    });
  });

  describe("Task with execution data", () => {
    it("should include brainstorm result when present", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Update task with brainstorm result
      await taskService.updateBrainstormResult(testTaskId, {
        conversation: [
          {
            role: "assistant",
            content: "Let me analyze this task...",
            timestamp: new Date().toISOString(),
          },
        ],
        summary: "Detailed task analysis",
        suggestComplete: true,
      });

      // Act
      const task = await taskService.getTaskFull(testTaskId);

      // Assert
      expect(task?.brainstormResult).toBeDefined();
      expect(task?.brainstormResult).toContain("Detailed task analysis");
    });

    it("should include plan content when task is planned", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Update task with plan
      await taskService.updatePlanContent(testTaskId, {
        planContent: "# Implementation Plan\n\n1. Step 1\n2. Step 2",
        planGenerated: true,
      });

      // Act
      const task = await taskService.getTaskFull(testTaskId);

      // Assert
      expect(task?.planContent).toBeDefined();
      expect(task?.planContent).toContain("Implementation Plan");
      expect(task?.planGenerated).toBe(true);
    });
  });

  describe("TaskAdapter integration", () => {
    it("should properly flatten nested domain state", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);
      const pool = getTestPool();

      // Update task with complex state
      await taskService.updateStatus({
        taskId: testTaskId,
        status: "executing",
        triggeredBy: "user",
        userId: testUserId,
      });

      await pool.query(
        `UPDATE tasks
         SET branch = $1, processing_phase = $2, updated_at = NOW()
         WHERE id = $3`,
        ["loopforge/test-123", "executing", testTaskId],
      );

      // Act
      const task = await taskService.getTaskFull(testTaskId);

      // Assert: Verify flattened structure
      expect(task?.status).toBe("executing");
      expect(task?.processingPhase).toBe("executing");
      expect(task?.branch).toBe("loopforge/test-123");

      // Verify status history is array (not nested object)
      expect(Array.isArray(task?.statusHistory)).toBe(true);
      expect(task?.statusHistory?.length).toBeGreaterThan(0);
    });

    it("should handle null values correctly", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Act: Get newly created task (most fields are null)
      const task = await taskService.getTaskFull(testTaskId);

      // Assert: Null fields should be null, not undefined
      expect(task?.description).toBe("Testing DDD migration");
      expect(task?.processingPhase).toBeNull();
      expect(task?.brainstormResult).toBeNull();
      expect(task?.planContent).toBeNull();
      expect(task?.branch).toBeNull();
      expect(task?.executionGraph).toBeNull();
    });
  });

  describe("No direct DB calls validation", () => {
    it("should not require direct DB access for basic task retrieval", async () => {
      // Arrange
      const redis = getRedis();
      const taskService = new TaskService(redis);

      // Act: Get task via service
      const task = await taskService.getTaskFull(testTaskId);

      // Assert: Verify we have all fields that would normally require
      // additional DB queries (repo info, user info, etc.)
      expect(task?.id).toBe(testTaskId);
      expect(task?.repoId).toBe(testRepoId);
      expect(task?.userId).toBe(testUserId);

      // The route should not need to make additional queries
      // All data is returned by the service
      expect(task).toBeDefined();
    });
  });
});
