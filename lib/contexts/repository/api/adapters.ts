/**
 * Repository API Adapters
 *
 * Maps between Repository domain models and API response/request formats.
 * Preserves backward compatibility with existing API contracts.
 */

import type { RepositoryState } from "../domain/repository-aggregate";
import type {
  RepositoryMetadata,
  CloneInfo,
  CloneStatus,
  IndexingStatus,
  TestConfiguration,
  PRConfiguration,
  TestGatePolicy,
} from "../domain/types";

/**
 * API response format for repository
 * Matches existing database schema and frontend expectations
 */
export interface RepositoryApiResponse {
  id: string;
  userId: string;

  // Repository metadata (flattened)
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  isPrivate: boolean;

  // Clone information (flattened)
  localPath: string | null; // Legacy field
  isCloned: boolean; // Legacy field
  clonedAt: Date | null; // Legacy field
  cloneStatus: CloneStatus;
  clonePath: string | null;
  cloneStartedAt: Date | null;
  cloneCompletedAt: Date | null;
  cloneError: string | null;

  // Indexing status
  indexingStatus: IndexingStatus;
  indexedAt: Date | null;

  // Test configuration (flattened)
  testCommand: string | null;
  testTimeout: number;
  testsEnabled: boolean;
  testGatePolicy: TestGatePolicy;
  criticalTestPatterns: string[];

  // PR configuration (flattened)
  prTitleTemplate: string;
  prTargetBranch: string | null;
  prDraftDefault: boolean;
  prReviewers: string[];
  prLabels: string[];
  autoApprove: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API request format for connecting repository
 */
export interface ConnectRepositoryRequest {
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  isPrivate: boolean;
}

/**
 * API request format for updating repository settings
 */
export interface UpdateRepositoryRequest {
  testCommand?: string | null;
  testTimeout?: number;
  testsEnabled?: boolean;
  testGatePolicy?: TestGatePolicy;
  criticalTestPatterns?: string[];
  prTitleTemplate?: string;
  prTargetBranch?: string | null;
  prDraftDefault?: boolean;
  prReviewers?: string[];
  prLabels?: string[];
  autoApprove?: boolean;
}

/**
 * Repository adapter - maps between domain and API formats
 */
export class RepositoryAdapter {
  /**
   * Convert domain state to API response format
   *
   * Flattens nested domain structure to match existing API contract.
   * Frontend expects flat structure with legacy field names.
   */
  static toApiResponse(state: RepositoryState): RepositoryApiResponse {
    return {
      // Identity
      id: state.id,
      userId: state.userId,

      // Repository metadata (flattened)
      githubRepoId: state.metadata.githubRepoId,
      name: state.metadata.name,
      fullName: state.metadata.fullName,
      defaultBranch: state.metadata.defaultBranch,
      cloneUrl: state.metadata.cloneUrl,
      isPrivate: state.metadata.isPrivate,

      // Clone information (flattened with legacy fields)
      localPath: state.cloneInfo.path, // Legacy field name
      isCloned: state.cloneInfo.status === "cloned", // Legacy boolean
      clonedAt: state.cloneInfo.completedAt, // Legacy field name
      cloneStatus: state.cloneInfo.status,
      clonePath: state.cloneInfo.path,
      cloneStartedAt: state.cloneInfo.startedAt,
      cloneCompletedAt: state.cloneInfo.completedAt,
      cloneError: state.cloneInfo.error,

      // Indexing status
      indexingStatus: state.indexingStatus,
      indexedAt: state.indexedAt,

      // Test configuration (flattened)
      testCommand: state.testConfig.command,
      testTimeout: state.testConfig.timeout,
      testsEnabled: state.testConfig.enabled,
      testGatePolicy: state.testConfig.gatePolicy,
      criticalTestPatterns: state.testConfig.criticalPatterns,

      // PR configuration (flattened)
      prTitleTemplate: state.prConfig.titleTemplate,
      prTargetBranch: state.prConfig.targetBranch,
      prDraftDefault: state.prConfig.draftDefault,
      prReviewers: state.prConfig.reviewers,
      prLabels: state.prConfig.labels,
      autoApprove: state.prConfig.autoApprove,

      // Timestamps
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  /**
   * Convert API connect request to domain metadata
   *
   * Extracts repository metadata from GitHub API response.
   */
  static fromConnectRequest(
    body: ConnectRepositoryRequest,
  ): RepositoryMetadata {
    return {
      githubRepoId: body.githubRepoId,
      name: body.name,
      fullName: body.fullName,
      defaultBranch: body.defaultBranch,
      cloneUrl: body.cloneUrl,
      isPrivate: body.isPrivate,
    };
  }

  /**
   * Convert API update request to domain configuration updates
   *
   * Extracts only the fields that can be updated through settings.
   * Only includes provided fields (partial update support).
   */
  static fromUpdateRequest(body: UpdateRepositoryRequest): {
    testConfig?: Partial<TestConfiguration>;
    prConfig?: Partial<PRConfiguration>;
  } {
    const result: {
      testConfig?: Partial<TestConfiguration>;
      prConfig?: Partial<PRConfiguration>;
    } = {};

    // Test configuration updates
    const testUpdates: Partial<TestConfiguration> = {};
    let hasTestUpdates = false;

    if (body.testCommand !== undefined) {
      testUpdates.command = body.testCommand;
      hasTestUpdates = true;
    }

    if (body.testTimeout !== undefined) {
      testUpdates.timeout = body.testTimeout;
      hasTestUpdates = true;
    }

    if (body.testsEnabled !== undefined) {
      testUpdates.enabled = body.testsEnabled;
      hasTestUpdates = true;
    }

    if (body.testGatePolicy !== undefined) {
      testUpdates.gatePolicy = body.testGatePolicy;
      hasTestUpdates = true;
    }

    if (body.criticalTestPatterns !== undefined) {
      testUpdates.criticalPatterns = body.criticalTestPatterns;
      hasTestUpdates = true;
    }

    if (hasTestUpdates) {
      result.testConfig = testUpdates;
    }

    // PR configuration updates
    const prUpdates: Partial<PRConfiguration> = {};
    let hasPrUpdates = false;

    if (body.prTitleTemplate !== undefined) {
      prUpdates.titleTemplate = body.prTitleTemplate;
      hasPrUpdates = true;
    }

    if (body.prTargetBranch !== undefined) {
      prUpdates.targetBranch = body.prTargetBranch;
      hasPrUpdates = true;
    }

    if (body.prDraftDefault !== undefined) {
      prUpdates.draftDefault = body.prDraftDefault;
      hasPrUpdates = true;
    }

    if (body.prReviewers !== undefined) {
      prUpdates.reviewers = body.prReviewers;
      hasPrUpdates = true;
    }

    if (body.prLabels !== undefined) {
      prUpdates.labels = body.prLabels;
      hasPrUpdates = true;
    }

    if (body.autoApprove !== undefined) {
      prUpdates.autoApprove = body.autoApprove;
      hasPrUpdates = true;
    }

    if (hasPrUpdates) {
      result.prConfig = prUpdates;
    }

    return result;
  }

  /**
   * Convert flat database row to domain RepositoryState
   *
   * Used when loading repository from database during migration.
   * Maps flat columns to nested domain structure.
   */
  static fromDatabaseRow(row: {
    id: string;
    userId: string;
    githubRepoId: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    cloneUrl: string;
    isPrivate: boolean;
    localPath?: string | null;
    isCloned?: boolean;
    clonedAt?: Date | null;
    cloneStatus?: CloneStatus | null;
    clonePath?: string | null;
    cloneStartedAt?: Date | null;
    cloneCompletedAt?: Date | null;
    cloneError?: string | null;
    indexingStatus: IndexingStatus;
    indexedAt?: Date | null;
    testCommand?: string | null;
    testTimeout?: number | null;
    testsEnabled?: boolean;
    testGatePolicy?: TestGatePolicy | null;
    criticalTestPatterns?: string[] | null;
    prTitleTemplate?: string | null;
    prTargetBranch?: string | null;
    prDraftDefault?: boolean;
    prReviewers?: string[] | null;
    prLabels?: string[] | null;
    autoApprove?: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RepositoryState {
    // Build repository metadata
    const metadata: RepositoryMetadata = {
      githubRepoId: row.githubRepoId,
      name: row.name,
      fullName: row.fullName,
      defaultBranch: row.defaultBranch,
      cloneUrl: row.cloneUrl,
      isPrivate: row.isPrivate,
    };

    // Build clone info
    const cloneInfo: CloneInfo = {
      status: row.cloneStatus ?? "not_cloned",
      path: row.clonePath ?? row.localPath ?? null,
      startedAt: row.cloneStartedAt ?? null,
      completedAt: row.cloneCompletedAt ?? row.clonedAt ?? null,
      error: row.cloneError ?? null,
    };

    // Build test configuration
    const testConfig: TestConfiguration = {
      command: row.testCommand ?? null,
      timeout: row.testTimeout ?? 300000,
      enabled: row.testsEnabled ?? true,
      gatePolicy: row.testGatePolicy ?? "warn",
      criticalPatterns: row.criticalTestPatterns ?? [],
    };

    // Build PR configuration
    const prConfig: PRConfiguration = {
      titleTemplate: row.prTitleTemplate ?? "[LoopForge] {{title}}",
      targetBranch: row.prTargetBranch ?? null,
      draftDefault: row.prDraftDefault ?? false,
      reviewers: row.prReviewers ?? [],
      labels: row.prLabels ?? [],
      autoApprove: row.autoApprove ?? false,
    };

    return {
      id: row.id,
      userId: row.userId,
      metadata,
      cloneInfo,
      indexingStatus: row.indexingStatus,
      indexedAt: row.indexedAt ?? null,
      testConfig,
      prConfig,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
