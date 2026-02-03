/**
 * Repository Service (Application Layer)
 *
 * CRUD operations for connected GitHub repositories.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { repos } from "@/lib/db/schema/tables";
import { eq, and } from "drizzle-orm";

export class RepositoryService {
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /** Get a single repo by ID with tasks. */
  async getRepositoryFull(repoId: string) {
    return db.query.repos.findFirst({
      where: eq(repos.id, repoId),
      with: { tasks: true },
    });
  }

  /** List repos owned by a user. */
  async listUserRepositories(userId: string) {
    return db.query.repos.findMany({
      where: eq(repos.userId, userId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  }

  /** Find repo by user + GitHub repo ID (dedup check). */
  async findByUserAndGithubId(userId: string, githubRepoId: string) {
    return db.query.repos.findFirst({
      where: and(
        eq(repos.userId, userId),
        eq(repos.githubRepoId, githubRepoId),
      ),
    });
  }

  // =========================================================================
  // Create / Delete
  // =========================================================================

  /**
   * Connect a new GitHub repository.
   * Uses ON CONFLICT DO NOTHING so concurrent calls are safe;
   * returns the new ID or null when the row already existed.
   */
  async connectRepository(params: {
    userId: string;
    githubRepoId: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    cloneUrl: string;
    isPrivate: boolean;
  }): Promise<string | null> {
    const repoId = crypto.randomUUID();

    const result = await db
      .insert(repos)
      .values({
        id: repoId,
        userId: params.userId,
        githubRepoId: params.githubRepoId,
        name: params.name,
        fullName: params.fullName,
        defaultBranch: params.defaultBranch,
        cloneUrl: params.cloneUrl,
        isPrivate: params.isPrivate,
      })
      .onConflictDoNothing({
        target: [repos.userId, repos.githubRepoId],
      })
      .returning({ id: repos.id });

    return result.length > 0 ? result[0].id : null;
  }

  /** Delete a repository (cascades tasks via DB FK). */
  async deleteRepository(repoId: string): Promise<void> {
    await db.delete(repos).where(eq(repos.id, repoId));
  }
}
