/**
 * Execution API Adapters
 *
 * Maps between Execution domain models and API response/request formats.
 * Preserves backward compatibility with existing API contracts.
 */

import type { ExecutionState } from "../domain/execution-aggregate";
import type {
  ExecutionStatus,
  ExecutionConfiguration,
  Iteration,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "../domain/types";

/**
 * API response format for execution
 * Matches existing database schema and frontend expectations
 */
export interface ExecutionApiResponse {
  id: string;
  taskId: string;
  status: ExecutionStatus;
  iteration: number;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  logsPath: string | null;

  // Branch and PR information
  branch: string;
  prUrl: string | null;
  prNumber: number | null;

  // Commits (simplified - array of SHAs for backward compatibility)
  commits: string[];

  // Rollback tracking
  reverted: boolean;
  revertCommitSha: string | null;
  revertedAt: Date | null;
  revertReason: string | null;

  // Reliability tracking (JSONB fields)
  stuckSignals: StuckSignal[] | null;
  recoveryAttempts: RecoveryAttempt[] | null;
  validationReport: ValidationReport | null;

  // Token metrics (JSONB field)
  tokenMetrics: Record<string, unknown> | null;

  // Skills tracking (JSONB field)
  skillExecutions: Array<{
    skillId: string;
    status: "passed" | "warning" | "blocked";
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }> | null;

  createdAt: Date;
}

/**
 * Extended execution API response with full details
 * Includes iteration history and commit details
 */
export interface ExecutionDetailedApiResponse extends ExecutionApiResponse {
  // Full iteration history
  iterations: Iteration[];

  // Full commit details
  commitDetails: CommitInfo[];

  // Configuration
  configuration: ExecutionConfiguration;
}

/**
 * API request format for starting execution
 */
export interface StartExecutionRequest {
  taskId: string;
  branchName: string;
  maxIterations?: number;
  enableStuckDetection?: boolean;
  enableRecovery?: boolean;
  enableCompletionValidation?: boolean;
  enableSkills?: boolean;
}

/**
 * Execution adapter - maps between domain and API formats
 */
export class ExecutionAdapter {
  /**
   * Convert domain state to API response format (basic)
   *
   * Returns simplified format for list views.
   * Frontend expects flat structure with JSONB fields as-is.
   */
  static toApiResponse(state: ExecutionState): ExecutionApiResponse {
    return {
      // Identity
      id: state.id,
      taskId: state.taskId,

      // Status
      status: state.status,
      iteration: state.currentIteration,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      errorMessage: state.error,
      logsPath: null, // Computed separately (not in domain)

      // Branch and PR
      branch: state.branchName,
      prUrl: null, // PR info stored in task, not execution
      prNumber: null,

      // Commits (simplified - just SHAs)
      commits: state.commits.map((c) => c.hash),

      // Rollback tracking (not in domain - future feature)
      reverted: false,
      revertCommitSha: null,
      revertedAt: null,
      revertReason: null,

      // Reliability tracking (JSONB fields - pass through)
      stuckSignals: state.stuckSignals.length > 0 ? state.stuckSignals : null,
      recoveryAttempts:
        state.recoveryAttempts.length > 0 ? state.recoveryAttempts : null,
      validationReport: state.validationReport,

      // Token metrics (not in current domain - future feature)
      tokenMetrics: null,

      // Skills tracking (not in current domain - future feature)
      skillExecutions: null,

      // Timestamps
      createdAt: state.startedAt, // Use startedAt as createdAt
    };
  }

  /**
   * Convert domain state to detailed API response format
   *
   * Returns full format with iterations and commit details for detail views.
   */
  static toDetailedApiResponse(
    state: ExecutionState,
  ): ExecutionDetailedApiResponse {
    const basic = ExecutionAdapter.toApiResponse(state);

    return {
      ...basic,
      iterations: state.iterations,
      commitDetails: state.commits,
      configuration: state.configuration,
    };
  }

  /**
   * Convert API start request to domain configuration
   *
   * Extracts configuration from start execution request.
   */
  static fromStartRequest(
    body: StartExecutionRequest,
  ): Partial<ExecutionConfiguration> {
    const config: Partial<ExecutionConfiguration> = {};

    if (body.maxIterations !== undefined) {
      config.maxIterations = body.maxIterations;
    }

    if (body.enableStuckDetection !== undefined) {
      config.enableStuckDetection = body.enableStuckDetection;
    }

    if (body.enableRecovery !== undefined) {
      config.enableRecovery = body.enableRecovery;
    }

    if (body.enableCompletionValidation !== undefined) {
      config.enableCompletionValidation = body.enableCompletionValidation;
    }

    if (body.enableSkills !== undefined) {
      config.enableSkills = body.enableSkills;
    }

    return config;
  }

  /**
   * Convert flat database row to domain ExecutionState
   *
   * Used when loading execution from database during migration.
   * Maps flat columns and JSONB fields to domain structure.
   */
  static fromDatabaseRow(row: {
    id: string;
    taskId: string;
    status: ExecutionStatus;
    iteration: number;
    startedAt?: Date | null;
    completedAt?: Date | null;
    errorMessage?: string | null;
    branch?: string | null;
    commits?: string[] | null;
    stuckSignals?: unknown;
    recoveryAttempts?: unknown;
    validationReport?: unknown;
    createdAt: Date;
  }): ExecutionState {
    // Parse JSONB fields
    const stuckSignals = Array.isArray(row.stuckSignals)
      ? (row.stuckSignals as StuckSignal[])
      : [];

    const recoveryAttempts = Array.isArray(row.recoveryAttempts)
      ? (row.recoveryAttempts as RecoveryAttempt[])
      : [];

    const validationReport =
      row.validationReport && typeof row.validationReport === "object"
        ? (row.validationReport as ValidationReport)
        : null;

    // Build commits from SHAs (we only have SHAs in DB, need full details from git)
    const commits: CommitInfo[] = (row.commits ?? []).map((hash) => ({
      hash,
      message: "", // Would be populated from git
      filesChanged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      timestamp: new Date(),
    }));

    // Build iterations (would need to be loaded from execution_events or logs)
    const iterations: Iteration[] = [];

    return {
      id: row.id,
      taskId: row.taskId,
      status: row.status,
      branchName: row.branch ?? "",
      configuration: {
        maxIterations: 50, // Default - would need separate config table
        iterationTimeout: 600000,
        enableStuckDetection: true,
        enableRecovery: true,
        enableCompletionValidation: true,
        enableSkills: true,
      },
      currentIteration: row.iteration,
      iterations,
      commits,
      stuckSignals,
      recoveryAttempts,
      validationReport,
      startedAt: row.startedAt ?? row.createdAt,
      completedAt: row.completedAt ?? null,
      error: row.errorMessage ?? null,
    };
  }
}
