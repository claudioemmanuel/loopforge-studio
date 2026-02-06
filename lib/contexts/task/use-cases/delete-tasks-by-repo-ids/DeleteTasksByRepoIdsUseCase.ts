/**
 * DeleteTasksByRepoIds Use Case
 * Bulk deletes all tasks for given repository IDs
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import type { IAnalyticsService } from "../ports/IAnalyticsService";
import { Result } from "@/lib/shared/Result";
import {
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface DeleteTasksByRepoIdsInput {
  repoIds: string[];
}

export type DeleteTasksByRepoIdsOutput = void;

export class DeleteTasksByRepoIdsUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly analytics: IAnalyticsService,
  ) {}

  async execute(
    input: DeleteTasksByRepoIdsInput,
  ): Promise<Result<DeleteTasksByRepoIdsOutput, UseCaseError>> {
    // 1. Validate input
    if (!Array.isArray(input.repoIds) || input.repoIds.length === 0) {
      return Result.fail(
        new ValidationError({
          repoIds: ["At least one repository ID is required"],
        }),
      );
    }

    // 2. Get task IDs before deletion (for analytics)
    const taskIdsResult = await this.taskRepo.getIdsByRepoIds(input.repoIds);

    if (taskIdsResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch task IDs", taskIdsResult.error),
      );
    }

    const taskIds = taskIdsResult.value;

    // 3. Delete all tasks for repositories
    const deleteResult = await this.taskRepo.deleteByRepoIds(input.repoIds);

    if (deleteResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to delete tasks", deleteResult.error),
      );
    }

    // 4. Publish domain events for each deleted task
    for (const taskId of taskIds) {
      const event = {
        type: "TaskDeleted" as const,
        aggregateId: taskId,
        occurredAt: new Date(),
        data: {},
      };
      await this.eventPublisher.publish(event);
    }

    // 5. Track analytics
    await this.analytics.trackEvent("tasks_bulk_deleted", {
      repoIds: input.repoIds,
      count: taskIds.length,
    });

    return Result.ok(undefined);
  }
}
