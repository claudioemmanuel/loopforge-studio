/**
 * Task Service integration tests (current application-layer contract).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { repos, taskDependencies, tasks, users } from "@/lib/db/schema/tables";
import { TaskService } from "@/lib/contexts/task/application/task-service";

describe("TaskService", () => {
  let redis: Redis;
  let taskService: TaskService;

  let userId: string;
  let repoId: string;
  let taskId: string;
  let blockerTaskId: string;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    taskService = new TaskService(redis);
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
      name: "task-repo",
      fullName: `owner/task-repo-${unique}`,
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/task-repo.git",
    });

    taskId = randomUUID();
    blockerTaskId = randomUUID();
    await db.insert(tasks).values([
      {
        id: taskId,
        repoId,
        title: "Main task",
        description: "Main task description",
        status: "todo",
        autonomousMode: true,
      },
      {
        id: blockerTaskId,
        repoId,
        title: "Blocker task",
        status: "done",
      },
    ]);

    await db.insert(taskDependencies).values({
      id: randomUUID(),
      taskId,
      blockedById: blockerTaskId,
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("returns task with repo ownership context", async () => {
    const task = await taskService.getTaskFull(taskId);

    expect(task).toBeDefined();
    expect(task?.id).toBe(taskId);
    expect(task?.repoId).toBe(repoId);
    expect(task?.repo.userId).toBe(userId);
  });

  it("lists tasks by repo and user", async () => {
    const byRepo = await taskService.listByRepo(repoId);
    const byUser = await taskService.listByUserId(userId);

    expect(byRepo.length).toBeGreaterThanOrEqual(2);
    expect(byUser.some((task) => task.id === taskId)).toBe(true);
    expect(await taskService.countByUser(userId)).toBeGreaterThanOrEqual(2);
  });

  it("updates fields and supports status-guarded updates", async () => {
    await taskService.updateFields(taskId, {
      title: "Main task updated",
      processingStatusText: "Queued",
    });

    const updated = await taskService.getTaskFull(taskId);
    expect(updated?.title).toBe("Main task updated");
    expect(updated?.processingStatusText).toBe("Queued");

    const ok = await taskService.updateIfStatus(taskId, ["todo"], {
      status: "planning",
    });
    expect(ok).toBe(true);

    const denied = await taskService.updateIfStatus(taskId, ["todo"], {
      status: "done",
    });
    expect(denied).toBe(false);
  });

  it("claims and clears processing slot", async () => {
    const claimed = await taskService.claimProcessingSlot(
      taskId,
      "brainstorming",
      "Analyzing task...",
      "brainstorming",
    );

    expect(claimed).toBeTruthy();
    expect(claimed?.status).toBe("brainstorming");
    expect(claimed?.processingPhase).toBe("brainstorming");

    await taskService.clearProcessingSlot(taskId, { status: "ready" });
    const cleared = await taskService.getTaskFull(taskId);
    expect(cleared?.processingPhase).toBeNull();
    expect(cleared?.processingJobId).toBeNull();
    expect(cleared?.status).toBe("ready");
  });

  it("provides dependency lookup helpers", async () => {
    const blockers = await taskService.listBlockersForTask(taskId);
    const dependents = await taskService.listDependentsByBlocker(blockerTaskId);
    const dependentsWithRepo =
      await taskService.listDependentsByBlockerWithRepo(blockerTaskId);

    expect(blockers.length).toBe(1);
    expect(blockers[0].blockedBy.id).toBe(blockerTaskId);
    expect(dependents.length).toBe(1);
    expect(dependents[0].task.id).toBe(taskId);
    expect(dependentsWithRepo[0].task.repo.id).toBe(repoId);
  });

  it("supports bulk IDs and deletion by repo IDs", async () => {
    const ids = await taskService.getIdsByRepoIds([repoId]);
    expect(ids).toContain(taskId);
    expect(ids).toContain(blockerTaskId);

    await taskService.deleteByRepoIds([repoId]);
    const remaining = await taskService.listByRepo(repoId);
    expect(remaining).toHaveLength(0);
  });
});
