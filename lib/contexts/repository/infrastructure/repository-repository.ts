/**
 * Repository Repository (Infrastructure Layer)
 *
 * Handles persistence and retrieval of Repository aggregates.
 * Translates between database schema and domain model.
 */

import { db } from "@/lib/db";
import { repos } from "@/lib/db/schema/tables";
import { eq, and } from "drizzle-orm";
import type { Redis } from "ioredis";
import {
  RepositoryAggregate,
  type RepositoryState,
} from "../domain/repository-aggregate";
import type {
  CloneStatus,
  IndexingStatus,
  RepositoryMetadata,
  TestConfiguration,
  PRConfiguration,
} from "../domain/types";
import { DEFAULT_TEST_CONFIG, DEFAULT_PR_CONFIG } from "../domain/types";

/**
 * Database row type for Repository-related columns only
 */
type RepositoryRow = {
  id: string;
  userId: string;
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  isPrivate: boolean;
  cloneStatus: string;
  clonePath: string | null;
  cloneStartedAt: Date | null;
  cloneCompletedAt: Date | null;
  indexingStatus: string;
  indexedAt: Date | null;
  testCommand: string | null;
  testTimeout: number | null;
  testGatePolicy: string | null;
  criticalTestPatterns: string[] | null;
  prTitleTemplate: string | null;
  prTargetBranch: string | null;
  prDraftDefault: boolean | null;
  prReviewers: string[] | null;
  prLabels: string[] | null;
  autoApprove: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Repository repository for database operations
 */
export class RepositoryRepository {
  constructor(private redis: Redis) {}

  /**
   * Find repository by ID
   */
  async findById(repoId: string): Promise<RepositoryAggregate | null> {
    const rows = await db
      .select({
        id: repos.id,
        userId: repos.userId,
        githubRepoId: repos.githubRepoId,
        name: repos.name,
        fullName: repos.fullName,
        defaultBranch: repos.defaultBranch,
        cloneUrl: repos.cloneUrl,
        isPrivate: repos.isPrivate,
        cloneStatus: repos.cloneStatus,
        clonePath: repos.clonePath,
        cloneStartedAt: repos.cloneStartedAt,
        cloneCompletedAt: repos.cloneCompletedAt,
        indexingStatus: repos.indexingStatus,
        indexedAt: repos.indexedAt,
        testCommand: repos.testCommand,
        testTimeout: repos.testTimeout,
        testGatePolicy: repos.testGatePolicy,
        criticalTestPatterns: repos.criticalTestPatterns,
        prTitleTemplate: repos.prTitleTemplate,
        prTargetBranch: repos.prTargetBranch,
        prDraftDefault: repos.prDraftDefault,
        prReviewers: repos.prReviewers,
        prLabels: repos.prLabels,
        autoApprove: repos.autoApprove,
        createdAt: repos.createdAt,
        updatedAt: repos.updatedAt,
      })
      .from(repos)
      .where(eq(repos.id, repoId));

    if (rows.length === 0) {
      return null;
    }

    const state = this.mapRowToState(rows[0]);
    return new RepositoryAggregate(state, this.redis);
  }

  /**
   * Find repository by user ID and GitHub repo ID
   */
  async findByUserAndGithubId(
    userId: string,
    githubRepoId: string,
  ): Promise<RepositoryAggregate | null> {
    const rows = await db
      .select({
        id: repos.id,
        userId: repos.userId,
        githubRepoId: repos.githubRepoId,
        name: repos.name,
        fullName: repos.fullName,
        defaultBranch: repos.defaultBranch,
        cloneUrl: repos.cloneUrl,
        isPrivate: repos.isPrivate,
        cloneStatus: repos.cloneStatus,
        clonePath: repos.clonePath,
        cloneStartedAt: repos.cloneStartedAt,
        cloneCompletedAt: repos.cloneCompletedAt,
        indexingStatus: repos.indexingStatus,
        indexedAt: repos.indexedAt,
        testCommand: repos.testCommand,
        testTimeout: repos.testTimeout,
        testGatePolicy: repos.testGatePolicy,
        criticalTestPatterns: repos.criticalTestPatterns,
        prTitleTemplate: repos.prTitleTemplate,
        prTargetBranch: repos.prTargetBranch,
        prDraftDefault: repos.prDraftDefault,
        prReviewers: repos.prReviewers,
        prLabels: repos.prLabels,
        autoApprove: repos.autoApprove,
        createdAt: repos.createdAt,
        updatedAt: repos.updatedAt,
      })
      .from(repos)
      .where(
        and(eq(repos.userId, userId), eq(repos.githubRepoId, githubRepoId)),
      );

    if (rows.length === 0) {
      return null;
    }

    const state = this.mapRowToState(rows[0]);
    return new RepositoryAggregate(state, this.redis);
  }

  /**
   * Save repository aggregate to database
   */
  async save(repository: RepositoryAggregate): Promise<void> {
    const state = repository.getState();
    const row = this.mapStateToRow(state);

    // Check if repository exists
    const existing = await db
      .select({ id: repos.id })
      .from(repos)
      .where(eq(repos.id, state.id));

    if (existing.length === 0) {
      // Insert new repository
      await db.insert(repos).values(row);
    } else {
      // Update existing repository
      await db.update(repos).set(row).where(eq(repos.id, state.id));
    }
  }

  /**
   * Map database row to domain state
   */
  private mapRowToState(row: RepositoryRow): RepositoryState {
    const metadata: RepositoryMetadata = {
      githubRepoId: row.githubRepoId,
      name: row.name,
      fullName: row.fullName,
      defaultBranch: row.defaultBranch,
      cloneUrl: row.cloneUrl,
      isPrivate: row.isPrivate,
    };

    const testConfig: TestConfiguration = {
      command: row.testCommand || DEFAULT_TEST_CONFIG.command,
      timeout: row.testTimeout || DEFAULT_TEST_CONFIG.timeout,
      enabled: row.testCommand !== null,
      gatePolicy:
        (row.testGatePolicy as TestConfiguration["gatePolicy"]) ||
        DEFAULT_TEST_CONFIG.gatePolicy,
      criticalPatterns: row.criticalTestPatterns || [],
    };

    const prConfig: PRConfiguration = {
      titleTemplate: row.prTitleTemplate || DEFAULT_PR_CONFIG.titleTemplate,
      targetBranch: row.prTargetBranch || DEFAULT_PR_CONFIG.targetBranch,
      draftDefault: row.prDraftDefault ?? DEFAULT_PR_CONFIG.draftDefault,
      reviewers: row.prReviewers || [],
      labels: row.prLabels || [],
      autoApprove: row.autoApprove ?? DEFAULT_PR_CONFIG.autoApprove,
    };

    return {
      id: row.id,
      userId: row.userId,
      metadata,
      cloneInfo: {
        status: row.cloneStatus as CloneStatus,
        path: row.clonePath,
        startedAt: row.cloneStartedAt,
        completedAt: row.cloneCompletedAt,
        error: null, // Not stored in DB yet
      },
      indexingStatus: row.indexingStatus as IndexingStatus,
      indexedAt: row.indexedAt,
      testConfig,
      prConfig,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain state to database row
   */
  private mapStateToRow(state: RepositoryState): Record<string, unknown> {
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
      clonePath: state.cloneInfo.path,
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
      updatedAt: state.updatedAt,
    };
  }
}
