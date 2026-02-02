/**
 * Repository Service (Application Layer)
 *
 * Orchestrates repository operations and coordinates with infrastructure.
 * Public API for Repository Management bounded context.
 */

import type { Redis } from "ioredis";
import { RepositoryRepository } from "../infrastructure/repository-repository";
import { RepositoryAggregate } from "../domain/repository-aggregate";
import type {
  RepositoryMetadata,
  TestConfiguration,
  PRConfiguration,
} from "../domain/types";
import { randomUUID } from "crypto";
import { RepositoryAdapter, type RepositoryApiResponse } from "../api/adapters";

/**
 * Repository service
 */
export class RepositoryService {
  private repository: RepositoryRepository;

  constructor(private redis: Redis) {
    this.repository = new RepositoryRepository(redis);
  }

  /**
   * Connect a new repository
   */
  async connectRepository(params: {
    userId: string;
    metadata: RepositoryMetadata;
  }): Promise<{ repositoryId: string }> {
    // Check if repository already exists
    const existing = await this.repository.findByUserAndGithubId(
      params.userId,
      params.metadata.githubRepoId,
    );

    if (existing) {
      throw new Error(
        `Repository ${params.metadata.fullName} is already connected`,
      );
    }

    // Create new repository aggregate
    const repoId = randomUUID();
    const repo = await RepositoryAggregate.connect(
      {
        id: repoId,
        userId: params.userId,
        metadata: params.metadata,
      },
      this.redis,
    );

    // Persist
    await this.repository.save(repo);

    return { repositoryId: repoId };
  }

  /**
   * Start clone operation
   */
  async startClone(params: {
    repositoryId: string;
    clonePath: string;
  }): Promise<void> {
    const repo = await this.repository.findById(params.repositoryId);
    if (!repo) {
      throw new Error(`Repository ${params.repositoryId} not found`);
    }

    await repo.startClone(params.clonePath);
    await this.repository.save(repo);
  }

  /**
   * Complete clone operation
   */
  async completeClone(repositoryId: string): Promise<void> {
    const repo = await this.repository.findById(repositoryId);
    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    await repo.completeClone();
    await this.repository.save(repo);
  }

  /**
   * Fail clone operation
   */
  async failClone(params: {
    repositoryId: string;
    error: string;
  }): Promise<void> {
    const repo = await this.repository.findById(params.repositoryId);
    if (!repo) {
      throw new Error(`Repository ${params.repositoryId} not found`);
    }

    await repo.failClone(params.error);
    await this.repository.save(repo);
  }

  /**
   * Start repository update (pull)
   */
  async startUpdate(repositoryId: string): Promise<void> {
    const repo = await this.repository.findById(repositoryId);
    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    await repo.startUpdate();
    await this.repository.save(repo);
  }

  /**
   * Complete repository update
   */
  async completeUpdate(repositoryId: string): Promise<void> {
    const repo = await this.repository.findById(repositoryId);
    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    await repo.completeUpdate();
    await this.repository.save(repo);
  }

  /**
   * Update test configuration
   */
  async updateTestConfig(params: {
    repositoryId: string;
    config: Partial<TestConfiguration>;
  }): Promise<void> {
    const repo = await this.repository.findById(params.repositoryId);
    if (!repo) {
      throw new Error(`Repository ${params.repositoryId} not found`);
    }

    await repo.updateTestConfig(params.config);
    await this.repository.save(repo);
  }

  /**
   * Update PR configuration
   */
  async updatePRConfig(params: {
    repositoryId: string;
    config: Partial<PRConfiguration>;
  }): Promise<void> {
    const repo = await this.repository.findById(params.repositoryId);
    if (!repo) {
      throw new Error(`Repository ${params.repositoryId} not found`);
    }

    repo.updatePRConfig(params.config);
    await this.repository.save(repo);
  }

  /**
   * Update indexing status
   */
  async updateIndexingStatus(params: {
    repositoryId: string;
    status: "pending" | "indexing" | "indexed" | "failed";
    indexedAt?: Date;
  }): Promise<void> {
    const repo = await this.repository.findById(params.repositoryId);
    if (!repo) {
      throw new Error(`Repository ${params.repositoryId} not found`);
    }

    repo.updateIndexingStatus(params.status, params.indexedAt);
    await this.repository.save(repo);
  }

  /**
   * Get repository by ID
   */
  async getRepository(repositoryId: string): Promise<{
    id: string;
    userId: string;
    metadata: RepositoryMetadata;
    cloneStatus: string;
    clonePath: string | null;
    indexingStatus: string;
    isCloned: boolean;
    isIndexed: boolean;
  } | null> {
    const repo = await this.repository.findById(repositoryId);
    if (!repo) {
      return null;
    }

    const state = repo.getState();
    return {
      id: state.id,
      userId: state.userId,
      metadata: state.metadata,
      cloneStatus: state.cloneInfo.status,
      clonePath: state.cloneInfo.path,
      indexingStatus: state.indexingStatus,
      isCloned: repo.isCloned(),
      isIndexed: repo.isIndexed(),
    };
  }

  /**
   * Get repository by user and GitHub repo ID
   */
  async getRepositoryByUserAndGithubId(
    userId: string,
    githubRepoId: string,
  ): Promise<{
    id: string;
    userId: string;
    metadata: RepositoryMetadata;
    cloneStatus: string;
    clonePath: string | null;
    indexingStatus: string;
    isCloned: boolean;
    isIndexed: boolean;
  } | null> {
    const repo = await this.repository.findByUserAndGithubId(
      userId,
      githubRepoId,
    );
    if (!repo) {
      return null;
    }

    const state = repo.getState();
    return {
      id: state.id,
      userId: state.userId,
      metadata: state.metadata,
      cloneStatus: state.cloneInfo.status,
      clonePath: state.cloneInfo.path,
      indexingStatus: state.indexingStatus,
      isCloned: repo.isCloned(),
      isIndexed: repo.isIndexed(),
    };
  }

  /**
   * Delete repository
   *
   * Removes repository from database. Cleanup of local files
   * should be handled separately.
   */
  async deleteRepository(repositoryId: string): Promise<void> {
    // Delete from database
    const { db, repos } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(repos).where(eq(repos.id, repositoryId));
  }

  /**
   * Get full repository state in API format
   *
   * Returns complete repository information formatted for API responses.
   * Uses RepositoryAdapter to transform domain state to API format.
   */
  async getRepositoryFull(
    repositoryId: string,
  ): Promise<RepositoryApiResponse | null> {
    const repo = await this.repository.findById(repositoryId);
    if (!repo) {
      return null;
    }

    const state = repo.getState();

    // Use adapter to transform to API format
    return RepositoryAdapter.toApiResponse(state);
  }

  /**
   * Update repository configuration (test + PR config)
   *
   * Convenience method for updating both test and PR configuration.
   */
  async updateConfiguration(params: {
    repositoryId: string;
    testConfig?: Partial<TestConfiguration>;
    prConfig?: Partial<PRConfiguration>;
  }): Promise<void> {
    if (params.testConfig) {
      await this.updateTestConfig({
        repositoryId: params.repositoryId,
        config: params.testConfig,
      });
    }

    if (params.prConfig) {
      await this.updatePRConfig({
        repositoryId: params.repositoryId,
        config: params.prConfig,
      });
    }
  }
}
