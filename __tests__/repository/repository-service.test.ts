/**
 * Repository Service Integration Tests
 *
 * Tests repository operations and event publishing.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users, domainEvents } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import { RepositoryService } from "@/lib/contexts/repository/application/repository-service";
import { IndexingService } from "@/lib/contexts/repository/application/indexing-service";
import type { RepositoryMetadata } from "@/lib/contexts/repository/domain/types";
import { randomUUID } from "crypto";

describe("Repository Service", () => {
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
    // Generate test user ID and create user in DB
    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      githubId: `github-${userId}`,
      username: `testuser-${userId.substring(0, 8)}`,
      email: `test-${userId.substring(0, 8)}@example.com`,
    });
  });

  afterAll(async () => {
    await db.delete(domainEvents);
    await db.delete(users);
    await redis.quit();
  });

  it("should connect repository and publish RepositoryConnected event", async () => {
    // Arrange
    const metadata: RepositoryMetadata = {
      githubRepoId: "123456",
      name: "test-repo",
      fullName: "testuser/test-repo",
      defaultBranch: "main",
      cloneUrl: "https://github.com/testuser/test-repo.git",
      isPrivate: false,
    };

    // Act
    const { repositoryId } = await repositoryService.connectRepository({
      userId,
      metadata,
    });

    // Assert
    expect(repositoryId).toBeDefined();

    // Verify repository was created
    const repo = await repositoryService.getRepository(repositoryId);
    expect(repo).not.toBeNull();
    expect(repo?.metadata.fullName).toBe("testuser/test-repo");
    expect(repo?.cloneStatus).toBe("not_cloned");
    expect(repo?.indexingStatus).toBe("pending");

    // Verify RepositoryConnected event was published
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "RepositoryConnected"));

    expect(events.length).toBeGreaterThan(0);
    const event = events[0];
    expect(event.aggregateType).toBe("Repository");
    expect(event.aggregateId).toBe(repositoryId);
    expect(event.data).toMatchObject({
      repositoryId,
      userId,
      githubRepoId: "123456",
      fullName: "testuser/test-repo",
      isPrivate: false,
    });
  });

  it("should handle clone lifecycle with events", async () => {
    // Arrange - Connect repository first
    const metadata: RepositoryMetadata = {
      githubRepoId: "789012",
      name: "clone-test-repo",
      fullName: "testuser/clone-test-repo",
      defaultBranch: "main",
      cloneUrl: "https://github.com/testuser/clone-test-repo.git",
      isPrivate: true,
    };

    const { repositoryId } = await repositoryService.connectRepository({
      userId,
      metadata,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Start clone
    await repositoryService.startClone({
      repositoryId,
      clonePath: "/tmp/test-clone",
    });

    // Assert - CloneStarted event
    let events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "CloneStarted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      repositoryId,
      clonePath: "/tmp/test-clone",
    });

    // Verify status updated
    let repo = await repositoryService.getRepository(repositoryId);
    expect(repo?.cloneStatus).toBe("cloning");

    // Clear events
    await db.delete(domainEvents);

    // Act - Complete clone
    await repositoryService.completeClone(repositoryId);

    // Assert - CloneCompleted event
    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "CloneCompleted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      repositoryId,
      clonePath: "/tmp/test-clone",
    });

    // Verify status updated
    repo = await repositoryService.getRepository(repositoryId);
    expect(repo?.cloneStatus).toBe("cloned");
    expect(repo?.isCloned).toBe(true);
  });

  it("should handle indexing lifecycle with events", async () => {
    // Arrange - Connect and clone repository first
    const metadata: RepositoryMetadata = {
      githubRepoId: "345678",
      name: "index-test-repo",
      fullName: "testuser/index-test-repo",
      defaultBranch: "main",
      cloneUrl: "https://github.com/testuser/index-test-repo.git",
      isPrivate: false,
    };

    const { repositoryId } = await repositoryService.connectRepository({
      userId,
      metadata,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Start indexing
    const { indexId } = await indexingService.startIndexing(repositoryId);

    // Assert - IndexingStarted event
    let events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "IndexingStarted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      repositoryId,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Complete indexing
    await indexingService.completeIndexing({
      repositoryId,
      metadata: {
        fileCount: 42,
        symbolCount: 123,
        techStack: {
          languages: ["TypeScript", "JavaScript"],
          frameworks: ["Next.js", "React"],
          packageManagers: ["npm"],
        },
        entryPoints: [
          {
            path: "src/index.ts",
            type: "main",
            description: "Main entry point",
          },
        ],
        dependencies: [
          {
            name: "react",
            version: "19.0.0",
            type: "production",
          },
        ],
      },
    });

    // Assert - IndexingCompleted event
    events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "IndexingCompleted"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      repositoryId,
      fileCount: 42,
      symbolCount: 123,
    });
  });

  it("should update test configuration and publish event", async () => {
    // Arrange - Connect repository first
    const metadata: RepositoryMetadata = {
      githubRepoId: "901234",
      name: "test-config-repo",
      fullName: "testuser/test-config-repo",
      defaultBranch: "main",
      cloneUrl: "https://github.com/testuser/test-config-repo.git",
      isPrivate: false,
    };

    const { repositoryId } = await repositoryService.connectRepository({
      userId,
      metadata,
    });

    // Clear events
    await db.delete(domainEvents);

    // Act - Update test config
    await repositoryService.updateTestConfig({
      repositoryId,
      config: {
        command: "npm test",
        timeout: 60000,
        enabled: true,
        gatePolicy: "strict",
      },
    });

    // Assert - TestConfigurationUpdated event
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, "TestConfigurationUpdated"));

    expect(events.length).toBe(1);
    expect(events[0].data).toMatchObject({
      repositoryId,
    });
  });
});
