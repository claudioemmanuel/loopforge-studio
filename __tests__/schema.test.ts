import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb } from "./setup/test-db";

// Unique prefix for this test file to avoid conflicts with parallel tests
const TEST_PREFIX = `schema-${Date.now()}`;

describe("Database Schema", () => {
  const db = getTestDb();

  describe("Users", () => {
    it("should create a user", async () => {
      const githubId = `${TEST_PREFIX}-user-create`;
      const [user] = await db.insert(schema.users).values({
        githubId,
        username: "testuser",
        email: "test@example.com",
      }).returning();

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe("testuser");
      expect(user.githubId).toBe(githubId);
    });

    it("should enforce unique github_id", async () => {
      const duplicateGithubId = `${TEST_PREFIX}-duplicate-${Math.random().toString(36).slice(2)}`;

      // First insert should succeed
      await db.insert(schema.users).values({
        githubId: duplicateGithubId,
        username: "user1",
      });

      // Second insert with same github_id should fail
      await expect(
        db.insert(schema.users).values({
          githubId: duplicateGithubId, // Same github_id - should fail
          username: "user2",
        })
      ).rejects.toThrow();
    });
  });

  describe("Repos", () => {
    it("should create a repo linked to a user", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-repo-user`,
        username: "testuser",
      }).returning();

      const [repo] = await db.insert(schema.repos).values({
        userId: user.id,
        githubRepoId: "repo-12345",
        name: "my-repo",
        fullName: "testuser/my-repo",
        cloneUrl: "https://github.com/testuser/my-repo.git",
      }).returning();

      expect(repo).toBeDefined();
      expect(repo.name).toBe("my-repo");
      expect(repo.userId).toBe(user.id);
    });
  });

  describe("Tasks", () => {
    it("should create a task with default status", async () => {
      // Setup user and repo first
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-task-user`,
        username: "testuser",
      }).returning();

      const [repo] = await db.insert(schema.repos).values({
        userId: user.id,
        githubRepoId: "repo-12345",
        name: "my-repo",
        fullName: "testuser/my-repo",
        cloneUrl: "https://github.com/testuser/my-repo.git",
      }).returning();

      const [task] = await db.insert(schema.tasks).values({
        repoId: repo.id,
        title: "Add user authentication",
        description: "Implement OAuth2 login",
      }).returning();

      expect(task).toBeDefined();
      expect(task.title).toBe("Add user authentication");
      expect(task.status).toBe("todo");
    });

    it("should update task status", async () => {
      const [user] = await db.insert(schema.users).values({
        githubId: `${TEST_PREFIX}-task-update-user`,
        username: "testuser",
      }).returning();

      const [repo] = await db.insert(schema.repos).values({
        userId: user.id,
        githubRepoId: "repo-12345",
        name: "my-repo",
        fullName: "testuser/my-repo",
        cloneUrl: "https://github.com/testuser/my-repo.git",
      }).returning();

      const [task] = await db.insert(schema.tasks).values({
        repoId: repo.id,
        title: "Test task",
      }).returning();

      await db
        .update(schema.tasks)
        .set({ status: "executing" })
        .where(eq(schema.tasks.id, task.id));

      const [updatedTask] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, task.id));

      expect(updatedTask?.status).toBe("executing");
    });
  });

  describe("Task Statuses", () => {
    it("should have all expected status values", () => {
      expect(schema.taskStatuses).toContain("todo");
      expect(schema.taskStatuses).toContain("brainstorming");
      expect(schema.taskStatuses).toContain("planning");
      expect(schema.taskStatuses).toContain("ready");
      expect(schema.taskStatuses).toContain("executing");
      expect(schema.taskStatuses).toContain("done");
      expect(schema.taskStatuses).toContain("stuck");
    });
  });

});
