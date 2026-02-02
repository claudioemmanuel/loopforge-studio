/**
 * AI Execution API (Public Interface)
 *
 * Backward-compatible wrapper for existing code.
 * Re-exports execution services for easy consumption.
 */

import { getRedis } from "@/lib/queue";
import { ExecutionService } from "../application/execution-service";
import type {
  ExecutionStatus,
  ExecutionConfiguration,
  ExtractionResult,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "../domain/types";

/**
 * Get execution service instance
 */
export function getExecutionService(): ExecutionService {
  const redis = getRedis();
  return new ExecutionService(redis);
}

/**
 * Re-export types for convenience
 */
export type {
  ExecutionStatus,
  ExecutionConfiguration,
  ExtractionResult,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "../domain/types";

/**
 * Re-export constants
 */
export {
  DEFAULT_EXECUTION_CONFIG,
  RECOVERY_TIERS,
  VALIDATION_WEIGHTS,
  VALIDATION_PASSING_THRESHOLD,
} from "../domain/types";
