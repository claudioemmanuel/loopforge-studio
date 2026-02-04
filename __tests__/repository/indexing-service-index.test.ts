/**
 * Indexing Service persistence tests
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users, repos, repoIndex } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import { IndexingService } from "@/lib/contexts/repository/application/indexing-service";
import { randomUUID } from "crypto";

describe("IndexingService persistence", () => {
  let redis: Redis;
  let indexingService: IndexingService;
  let userId: string;
  let repositoryId: string;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    indexingService = new IndexingService(redis);
  });

  beforeEach(async () => {
    userId = randomUUID();
    repositoryId = randomUUID();

    await db.insert(users).values({
      id: userId,
      githubId: `github-${userId}`,
      username: `testuser-${userId.substring(0, 8)}`,
      email: `test-${userId.substring(0, 8)}@example.com`,
    });

    await db.insert(repos).values({
      id: repositoryId,
      userId,
      githubRepoId: `repo-${repositoryId}`,
      fullName: `testuser/repo-${repositoryId.substring(0, 8)}`,
      name: `repo-${repositoryId.substring(0, 8)}`,
      cloneUrl: "https://github.com/testuser/testrepo.git",
      defaultBranch: "main",
    });
  });

  afterAll(async () => {
    await db.delete(repoIndex);
    await db.delete(repos);
    await db.delete(users);
    await redis.quit();
  });

  it("persists repo index data on completion", async () => {
    await indexingService.completeIndexingWithResult({
      repositoryId,
      result: {
        fileCount: 10,
        symbolCount: 0,
        techStack: {
          languages: ["TypeScript"],
          frameworks: ["Next.js"],
          buildTools: ["npm"],
          packageManager: "npm",
        },
        entryPoints: [],
        dependencies: [],
        fileIndex: [],
      },
    });

    const saved = await db
      .select()
      .from(repoIndex)
      .where(eq(repoIndex.repoId, repositoryId));

    expect(saved.length).toBe(1);
    expect(saved[0].fileCount).toBe(10);
    expect(saved[0].techStack).toMatchObject({
      languages: ["TypeScript"],
      frameworks: ["Next.js"],
      buildTools: ["npm"],
    });
  });
});
