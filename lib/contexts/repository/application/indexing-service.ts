/**
 * Indexing Service (Application Layer)
 *
 * Orchestrates repository indexing operations.
 * Manages RepoIndex aggregate lifecycle.
 */

import type { Redis } from "ioredis";
import { RepoIndexAggregate } from "../domain/repo-index-aggregate";
import type {
  Dependency,
  EntryPoint,
  IndexMetadata,
  TechStack,
} from "../domain/types";
import type { IndexingResult } from "@/lib/indexing/types";
import { randomUUID } from "crypto";
import { RepoIndexRepository } from "../infrastructure/repo-index-repository";

/**
 * Indexing service
 */
export class IndexingService {
  private repoIndexRepository: RepoIndexRepository;

  constructor(private redis: Redis) {
    this.repoIndexRepository = new RepoIndexRepository();
  }

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
   * Complete indexing and persist results
   */
  async completeIndexingWithResult(params: {
    repositoryId: string;
    result: IndexingResult;
  }): Promise<void> {
    const metadata = this.mapResultToMetadata(params.result);

    await this.completeIndexing({
      repositoryId: params.repositoryId,
      metadata,
    });

    await this.repoIndexRepository.upsertIndex({
      repositoryId: params.repositoryId,
      result: params.result,
    });
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

  private mapResultToMetadata(result: IndexingResult): IndexMetadata {
    const techStack: TechStack = {
      languages: result.techStack.languages,
      frameworks: result.techStack.frameworks,
      packageManagers: result.techStack.packageManager
        ? [result.techStack.packageManager]
        : result.techStack.buildTools,
    };

    const entryPoints: EntryPoint[] = result.entryPoints.map((entry) => ({
      path: entry.path,
      type: entry.type === "config" ? "config" : "main",
      description: entry.description,
    }));

    const dependencies: Dependency[] = result.dependencies.map((dep) => ({
      name: dep.name,
      version: dep.version ?? "unknown",
      type: dep.type === "peer" ? "development" : dep.type,
    }));

    return {
      fileCount: result.fileCount,
      symbolCount: result.symbolCount,
      techStack,
      entryPoints,
      dependencies,
    };
  }
}
