/**
 * Execution Repository (Infrastructure Layer)
 *
 * Handles persistence and retrieval of Execution aggregates.
 * Translates between database schema and domain model.
 */

import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import {
  ExecutionAggregate,
  type ExecutionState,
} from "../domain/execution-aggregate";
import type {
  ExecutionStatus,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "../domain/types";
import { DEFAULT_EXECUTION_CONFIG } from "../domain/types";

/**
 * Database row type for Execution-related columns only
 */
type ExecutionRow = {
  id: string;
  taskId: string;
  status: string;
  iteration: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  branch: string | null;
  commits: string[] | null;
  stuckSignals: StuckSignal[] | null | unknown;
  recoveryAttempts: RecoveryAttempt[] | null | unknown;
  validationReport: ValidationReport | null | unknown;
};

/**
 * Execution repository for database operations
 */
export class ExecutionRepository {
  constructor(private redis: Redis) {}

  /**
   * Find execution by ID
   */
  async findById(executionId: string): Promise<ExecutionAggregate | null> {
    const rows = await db
      .select({
        id: executions.id,
        taskId: executions.taskId,
        status: executions.status,
        iteration: executions.iteration,
        startedAt: executions.startedAt,
        completedAt: executions.completedAt,
        errorMessage: executions.errorMessage,
        branch: executions.branch,
        commits: executions.commits,
        stuckSignals: executions.stuckSignals,
        recoveryAttempts: executions.recoveryAttempts,
        validationReport: executions.validationReport,
      })
      .from(executions)
      .where(eq(executions.id, executionId));

    if (rows.length === 0) {
      return null;
    }

    const state = this.mapRowToState(rows[0]);
    return new ExecutionAggregate(state, this.redis);
  }

  /**
   * Save execution aggregate to database
   */
  async save(execution: ExecutionAggregate): Promise<void> {
    const state = execution.getState();
    const row = this.mapStateToRow(state);

    // Check if execution exists
    const existing = await db
      .select({ id: executions.id })
      .from(executions)
      .where(eq(executions.id, state.id));

    if (existing.length === 0) {
      // Insert new execution
      await db.insert(executions).values(row);
    } else {
      // Update existing execution
      await db.update(executions).set(row).where(eq(executions.id, state.id));
    }
  }

  /**
   * Map database row to domain state
   */
  private mapRowToState(row: ExecutionRow): ExecutionState {
    // Parse stuck signals
    let stuckSignals: StuckSignal[] = [];
    if (row.stuckSignals) {
      try {
        stuckSignals = row.stuckSignals as StuckSignal[];
      } catch {
        stuckSignals = [];
      }
    }

    // Parse recovery attempts
    let recoveryAttempts: RecoveryAttempt[] = [];
    if (row.recoveryAttempts) {
      try {
        recoveryAttempts = row.recoveryAttempts as RecoveryAttempt[];
      } catch {
        recoveryAttempts = [];
      }
    }

    // Parse validation report
    let validationReport: ValidationReport | null = null;
    if (row.validationReport) {
      try {
        validationReport = row.validationReport as ValidationReport;
      } catch {
        validationReport = null;
      }
    }

    return {
      id: row.id,
      taskId: row.taskId,
      status: row.status as ExecutionStatus,
      branchName: row.branch || "",
      configuration: DEFAULT_EXECUTION_CONFIG,
      currentIteration: row.iteration,
      iterations: [], // Not stored in DB
      commits: (row.commits || []).map((hash) => ({
        hash,
        message: "",
        filesChanged: 0,
        linesAdded: 0,
        linesDeleted: 0,
        timestamp: new Date(),
      })),
      stuckSignals,
      recoveryAttempts,
      validationReport,
      startedAt: row.startedAt || new Date(),
      completedAt: row.completedAt,
      error: row.errorMessage,
    };
  }

  /**
   * Map domain state to database row
   */
  private mapStateToRow(state: ExecutionState): typeof executions.$inferInsert {
    return {
      id: state.id,
      taskId: state.taskId,
      status: state.status,
      iteration: state.currentIteration,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      errorMessage: state.error,
      branch: state.branchName || null,
      commits: state.commits.map((c) => c.hash),
      stuckSignals: state.stuckSignals,
      recoveryAttempts: state.recoveryAttempts,
      validationReport: state.validationReport,
    };
  }
}
