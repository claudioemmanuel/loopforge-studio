/**
 * Repository Service integration tests (current application-layer contract).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { repos, users } from "@/lib/db/schema/tables";
import { RepositoryService } from "@/lib/contexts/repository/application/repository-service";
import { IndexingService } from "@/lib/contexts/repository/application/indexing-service";

describe("RepositoryService", () => {
  let redis: Redis;
  let repositoryService: RepositoryService;
  let indexingService: IndexingService;
  let userId: string;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    repositoryService = new RepositoryService(redis);
    indexingService = new IndexingService(redis);
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
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("connects repository and prevents duplicates for same user/github pair", async () => {
    const githubRepoId = `${Date.now()}`;

    const repoId = await repositoryService.connectRepository({
      userId,
      githubRepoId,
      name: "repo-a",
      fullName: "owner/repo-a",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-a.git",
      isPrivate: false,
    });

    expect(repoId).toBeTruthy();

    const duplicate = await repositoryService.connectRepository({
      userId,
      githubRepoId,
      name: "repo-a",
      fullName: "owner/repo-a",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-a.git",
      isPrivate: false,
    });
    expect(duplicate).toBeNull();
  });

  it("supports ownership lookups and listing", async () => {
    const repoId = await repositoryService.connectRepository({
      userId,
      githubRepoId: `${Date.now()}-owned`,
      name: "repo-owned",
      fullName: "owner/repo-owned",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-owned.git",
      isPrivate: true,
    });
    expect(repoId).toBeTruthy();

    const found = await repositoryService.findByOwner(repoId!, userId);
    expect(found?.id).toBe(repoId);
    expect(found?.fullName).toBe("owner/repo-owned");
    expect(found?.isCloned).toBe(false);

    const list = await repositoryService.listUserRepositories(userId);
    expect(list.some((repo) => repo.id === repoId)).toBe(true);
    expect(await repositoryService.countByUser(userId)).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("tracks clone lifecycle and verification fields", async () => {
    const repoId = await repositoryService.connectRepository({
      userId,
      githubRepoId: `${Date.now()}-clone`,
      name: "repo-clone",
      fullName: "owner/repo-clone",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-clone.git",
      isPrivate: false,
    });
    expect(repoId).toBeTruthy();

    await repositoryService.markCloneStarted(repoId!);
    let repo = await repositoryService.getById(repoId!);
    expect(repo?.cloneStatus).toBe("cloning");

    await repositoryService.markCloneCompleted(repoId!, "/tmp/repo-clone");
    repo = await repositoryService.getById(repoId!);
    expect(repo?.cloneStatus).toBe("cloned");
    expect(repo?.isCloned).toBe(true);
    expect(repo?.localPath).toBe("/tmp/repo-clone");
    expect(repo?.clonePath).toBe("/tmp/repo-clone");
    expect(repo?.clonedAt).toBeTruthy();

    await repositoryService.markCloneFailed(repoId!);
    repo = await repositoryService.getById(repoId!);
    expect(repo?.cloneStatus).toBe("failed");

    await repositoryService.markRepositoryCloneVerified(
      repoId!,
      "/tmp/verified",
    );
    repo = await repositoryService.getById(repoId!);
    expect(repo?.cloneStatus).toBe("cloned");
    expect(repo?.localPath).toBe("/tmp/verified");
  });

  it("updates repository fields and returns full repository payload", async () => {
    const repoId = await repositoryService.connectRepository({
      userId,
      githubRepoId: `${Date.now()}-cfg`,
      name: "repo-cfg",
      fullName: "owner/repo-cfg",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-cfg.git",
      isPrivate: false,
    });
    expect(repoId).toBeTruthy();

    await repositoryService.updateRepository(repoId!, {
      testCommand: "npm test",
      testTimeout: 120000,
    });

    const full = await repositoryService.getRepositoryFull(repoId!);
    expect(full?.id).toBe(repoId);
    expect(full?.testCommand).toBe("npm test");
    expect(full?.testTimeout).toBe(120000);
    expect(Array.isArray(full?.tasks)).toBe(true);
  });

  it("starts indexing and deletes repositories by user", async () => {
    const repoId = await repositoryService.connectRepository({
      userId,
      githubRepoId: `${Date.now()}-index`,
      name: "repo-index",
      fullName: "owner/repo-index",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-index.git",
      isPrivate: false,
    });
    expect(repoId).toBeTruthy();

    const { indexId } = await indexingService.startIndexing(repoId!);
    expect(indexId).toBeTruthy();

    await repositoryService.deleteAllByUser(userId);
    const rows = await db.query.repos.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
    });
    expect(rows).toHaveLength(0);
  });

  it("gets repository with index by owner shape", async () => {
    const repoId = await repositoryService.connectRepository({
      userId,
      githubRepoId: `${Date.now()}-idx-shape`,
      name: "repo-idx-shape",
      fullName: "owner/repo-idx-shape",
      defaultBranch: "main",
      cloneUrl: "https://github.com/owner/repo-idx-shape.git",
      isPrivate: false,
    });
    expect(repoId).toBeTruthy();

    const withIndex = await repositoryService.getRepositoryWithIndexByOwner(
      repoId!,
      userId,
    );
    expect(withIndex?.id).toBe(repoId);
  });
});
