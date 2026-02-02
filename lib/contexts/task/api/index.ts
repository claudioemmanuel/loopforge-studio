/**
 * Task Orchestration API (Public Interface)
 *
 * Backward-compatible wrapper for existing code.
 * Re-exports task services for easy consumption.
 */

import { getRedis } from "@/lib/queue";
import { TaskService } from "../application/task-service";
import type {
  TaskStatus,
  TaskMetadata,
  TaskConfiguration,
  BrainstormResult,
  ExecutionResult,
} from "../domain/types";

/**
 * Get task service instance
 */
export function getTaskService(): TaskService {
  const redis = getRedis();
  return new TaskService(redis);
}

/**
 * Re-export types for convenience
 */
export type {
  TaskStatus,
  TaskMetadata,
  TaskConfiguration,
  BrainstormResult,
  ExecutionResult,
} from "../domain/types";

/**
 * Re-export utilities
 */
export {
  isValidTransition,
  getProcessingPhaseForStatus,
} from "../domain/types";
