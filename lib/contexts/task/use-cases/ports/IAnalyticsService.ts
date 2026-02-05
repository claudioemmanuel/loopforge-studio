import type { Result } from "@/lib/shared/Result";
import type { UseCaseError } from "@/lib/shared/errors";

/**
 * Analytics service port interface
 *
 * Tracks task-related events for analytics and reporting.
 * Use cases call these methods to record significant events.
 */
export interface IAnalyticsService {
  taskCreated(
    taskId: string,
    repoId: string,
  ): Promise<Result<void, UseCaseError>>;
  taskStatusChanged(
    taskId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<Result<void, UseCaseError>>;
  brainstormingStarted(taskId: string): Promise<Result<void, UseCaseError>>;
  brainstormingCompleted(taskId: string): Promise<Result<void, UseCaseError>>;
  planningStarted(taskId: string): Promise<Result<void, UseCaseError>>;
  planningCompleted(taskId: string): Promise<Result<void, UseCaseError>>;
  executionStarted(taskId: string): Promise<Result<void, UseCaseError>>;
  executionCompleted(taskId: string): Promise<Result<void, UseCaseError>>;
}
