/**
 * Indexing Service (Application Layer)
 *
 * Orchestrates repository indexing operations.
 * Manages RepoIndex aggregate lifecycle.
 */

import type { Redis } from "ioredis";
import { RepoIndexAggregate } from "../domain/repo-index-aggregate";
import type { IndexMetadata } from "../domain/types";
import { randomUUID } from "crypto";

/**
 * Indexing service
 */
export class IndexingService {
  constructor(private redis: Redis) {}

  /**
   * Start indexing for a repository
   */
  async startIndexing(repositoryId: string): Promise<{ indexId: string }> {
    // Create new index aggregate
    const indexId = randomUUID();
    const index = RepoIndexAggregate.create(
      {
        id: indexId,
        repositoryId,
      },
      this.redis,
    );

    // Publish IndexingStarted event
    await index.startIndexing();

    return { indexId };
  }

  /**
   * Complete indexing with metadata
   */
  async completeIndexing(params: {
    repositoryId: string;
    metadata: IndexMetadata;
  }): Promise<void> {
    // For now, create a temporary index aggregate
    // In a full implementation, we'd retrieve the existing one
    const index = RepoIndexAggregate.create(
      {
        id: randomUUID(),
        repositoryId: params.repositoryId,
      },
      this.redis,
    );

    await index.completeIndexing(params.metadata);
  }

  /**
   * Fail indexing with error
   */
  async failIndexing(params: {
    repositoryId: string;
    error: string;
  }): Promise<void> {
    // For now, create a temporary index aggregate
    const index = RepoIndexAggregate.create(
      {
        id: randomUUID(),
        repositoryId: params.repositoryId,
      },
      this.redis,
    );

    await index.failIndexing(params.error);
  }
}
