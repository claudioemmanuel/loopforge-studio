/**
 * Repository Service (Application Layer)
 *
 * CRUD operations for connected GitHub repositories.
 */

import type { Redis } from "ioredis";
import { RepositoryRepository } from "../infrastructure/repository-repository";
import {
  RepositoryAggregate,
  type RepositoryState,
} from "../domain/repository-aggregate";

export function buildVerifiedCloneFields(
  localPath: string,
  now = new Date(),
): {
  localPath: string;
  clonePath: string;
  isCloned: true;
  cloneStatus: "completed";
  clonedAt: Date;
  cloneCompletedAt: Date;
  indexingStatus: "pending";
  updatedAt: Date;
} {
  return {
    localPath,
    clonePath: localPath,
    isCloned: true,
    cloneStatus: "completed",
    clonedAt: now,
    cloneCompletedAt: now,
    indexingStatus: "pending",
    updatedAt: now,
  };
}

export function buildCloneStartedFields(now = new Date()): {
  cloneStatus: "cloning";
  cloneStartedAt: Date;
  updatedAt: Date;
} {
  return {
    cloneStatus: "cloning",
    cloneStartedAt: now,
    updatedAt: now,
  };
}

export function buildCloneCompletedFields(
  localPath: string,
  now = new Date(),
): {
  localPath: string;
  isCloned: true;
  clonedAt: Date;
  cloneStatus: "completed";
  clonePath: string;
  cloneCompletedAt: Date;
  indexingStatus: "pending";
  updatedAt: Date;
} {
  return {
    localPath,
    isCloned: true,
    clonedAt: now,
    cloneStatus: "completed",
    clonePath: localPath,
    cloneCompletedAt: now,
    indexingStatus: "pending",
    updatedAt: now,
  };
}

export function buildCloneFailedFields(now = new Date()): {
  cloneStatus: "failed";
  updatedAt: Date;
} {
  return {
    cloneStatus: "failed",
    updatedAt: now,
  };
}

export class RepositoryService {
  private redis: Redis;
  private repository: RepositoryRepository;

  constructor(redis: Redis) {
    this.redis = redis;
    this.repository = new RepositoryRepository(redis);
  }

  /**
   * Convert aggregate to plain DTO matching database query format
   */
  private aggregateToDTO(aggregate: RepositoryAggregate) {
    const state = aggregate.getState();
    return {
      id: state.id,
      userId: state.userId,
      githubRepoId: state.metadata.githubRepoId,
      name: state.metadata.name,
      fullName: state.metadata.fullName,
      defaultBranch: state.metadata.defaultBranch,
      cloneUrl: state.metadata.cloneUrl,
      isPrivate: state.metadata.isPrivate,
      cloneStatus: state.cloneInfo.status,
      localPath: state.cloneInfo.path,
      cloneStartedAt: state.cloneInfo.startedAt,
      cloneCompletedAt: state.cloneInfo.completedAt,
      indexingStatus: state.indexingStatus,
      indexedAt: state.indexedAt,
      testCommand: state.testConfig.command,
      testTimeout: state.testConfig.timeout,
      testGatePolicy: state.testConfig.gatePolicy,
      criticalTestPatterns: state.testConfig.criticalPatterns,
      prTitleTemplate: state.prConfig.titleTemplate,
      prTargetBranch: state.prConfig.targetBranch,
      prDraftDefault: state.prConfig.draftDefault,
      prReviewers: state.prConfig.reviewers,
      prLabels: state.prConfig.labels,
      autoApprove: state.prConfig.autoApprove,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /** Get a single repo by ID with tasks. */
  async getRepositoryFull(repoId: string) {
    const aggregate = await this.repository.findById(repoId);
    if (!aggregate) return null;

    // Convert to DTO
    const repo = this.aggregateToDTO(aggregate);

    // Fetch tasks separately (repository aggregate does not load relations)
    const repoTasks = await this.repository.listTasksByRepoId(repoId);

    return { ...repo, tasks: repoTasks };
  }

  /** List repos owned by a user. */
  async listUserRepositories(userId: string) {
    const aggregates = await this.repository.findByUser(userId);
    return aggregates.map((agg) => this.aggregateToDTO(agg));
  }

  /** Find repo by user + GitHub repo ID (dedup check). */
  async findByUserAndGithubId(userId: string, githubRepoId: string) {
    const aggregate = await this.repository.findByUserAndGithubId(
      userId,
      githubRepoId,
    );
    return aggregate ? this.aggregateToDTO(aggregate) : null;
  }

  /** Get repository by ID without owner guard (internal worker usage). */
  async getById(repoId: string) {
    const aggregate = await this.repository.findById(repoId);
    return aggregate ? this.aggregateToDTO(aggregate) : null;
  }

  /** Get repository index record by repository ID. */
  async getRepoIndexByRepoId(repoId: string) {
    return this.repository.findRepoIndexByRepoId(repoId);
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
    // Check if already exists
    const existing = await this.repository.findByUserAndGithubId(
      params.userId,
      params.githubRepoId,
    );

    if (existing) {
      return null; // Already exists
    }

    const repoId = crypto.randomUUID();

    // Create new repository aggregate
    const aggregate = await RepositoryAggregate.connect(
      {
        id: repoId,
        userId: params.userId,
        metadata: {
          githubRepoId: params.githubRepoId,
          name: params.name,
          fullName: params.fullName,
          defaultBranch: params.defaultBranch,
          cloneUrl: params.cloneUrl,
          isPrivate: params.isPrivate,
        },
      },
      this.redis,
    );

    await this.repository.save(aggregate);
    return repoId;
  }

  /** Delete a repository (cascades tasks via DB FK). */
  async deleteRepository(repoId: string): Promise<void> {
    await this.repository.delete(repoId);
  }

  /** Delete all repos for a user (account cleanup). */
  async deleteAllByUser(userId: string): Promise<void> {
    await this.repository.deleteByUser(userId);
  }

  /** Find a repo only if it belongs to the given user (ownership gate). */
  async findByOwner(repoId: string, userId: string) {
    const aggregate = await this.repository.findByOwner(repoId, userId);
    return aggregate ? this.aggregateToDTO(aggregate) : null;
  }

  /** Find repository with index metadata for clone/indexing status UIs. */
  async getRepositoryWithIndexByOwner(repoId: string, userId: string) {
    return this.repository.findRepositoryWithIndexByOwner(repoId, userId);
  }

  /** Mark an existing local clone as verified and ready for indexing. */
  async markRepositoryCloneVerified(
    repoId: string,
    localPath: string,
  ): Promise<void> {
    await this.repository.markRepositoryCloneVerified(
      repoId,
      buildVerifiedCloneFields(localPath),
    );
  }

  async markCloneStarted(repoId: string): Promise<void> {
    await this.repository.markCloneStarted(repoId, buildCloneStartedFields());
  }

  async markCloneCompleted(repoId: string, localPath: string): Promise<void> {
    await this.repository.markCloneCompleted(
      repoId,
      buildCloneCompletedFields(localPath),
    );
  }

  async markCloneFailed(repoId: string): Promise<void> {
    await this.repository.markCloneFailed(repoId, buildCloneFailedFields());
  }

  /** Partial update on a repository row. */
  async updateRepository(
    repoId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const aggregate = await this.repository.findById(repoId);
    if (!aggregate) {
      throw new Error(`Repository ${repoId} not found`);
    }

    // Update the aggregate with the new fields
    const state = aggregate.getState();
    const updatedState: RepositoryState = {
      ...state,
      metadata: { ...state.metadata },
      cloneInfo: { ...state.cloneInfo },
      testConfig: { ...state.testConfig },
      prConfig: { ...state.prConfig },
      updatedAt: new Date(),
    };

    if (typeof fields.name === "string") {
      updatedState.metadata.name = fields.name;
    }
    if (typeof fields.fullName === "string") {
      updatedState.metadata.fullName = fields.fullName;
    }
    if (typeof fields.defaultBranch === "string") {
      updatedState.metadata.defaultBranch = fields.defaultBranch;
    }
    if (typeof fields.cloneUrl === "string") {
      updatedState.metadata.cloneUrl = fields.cloneUrl;
    }
    if (typeof fields.isPrivate === "boolean") {
      updatedState.metadata.isPrivate = fields.isPrivate;
    }

    if (typeof fields.localPath === "string" || fields.localPath === null) {
      updatedState.cloneInfo.path = fields.localPath as string | null;
    }

    if (typeof fields.testCommand === "string") {
      updatedState.testConfig.command = fields.testCommand;
      updatedState.testConfig.enabled = true;
    }
    if (typeof fields.testTimeout === "number") {
      updatedState.testConfig.timeout = fields.testTimeout;
    }
    if (typeof fields.testGatePolicy === "string") {
      updatedState.testConfig.gatePolicy =
        fields.testGatePolicy as RepositoryState["testConfig"]["gatePolicy"];
    }

    // Save the updated aggregate
    const updatedAggregate = new RepositoryAggregate(updatedState, this.redis);

    await this.repository.save(updatedAggregate);
  }

  /**
   * Count repositories for a user.
   * Used by BillingService for limit checks.
   */
  async countByUser(userId: string): Promise<number> {
    const aggregates = await this.repository.findByUser(userId);
    return aggregates.length;
  }

  // =========================================================================
  // Analytics delegation methods
  // =========================================================================

  /**
   * Get repository info for analytics (id, fullName).
   * Used by AnalyticsService for repo activity metrics.
   */
  async getReposForAnalytics(
    userId: string,
  ): Promise<Array<{ id: string; fullName: string }>> {
    const aggregates = await this.repository.findByUser(userId);
    return aggregates.map((aggregate) => {
      const state = aggregate.getState();
      return {
        id: state.id,
        fullName: state.metadata.fullName,
      };
    });
  }
}
