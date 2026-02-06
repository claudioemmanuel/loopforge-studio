/**
 * DeleteTask Use Case
 * Deletes a task from the repository
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import type { IAnalyticsService } from "../ports/IAnalyticsService";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";
import type { DomainEvent } from "../../entities/events";

export interface DeleteTaskInput {
  taskId: string;
}

export type DeleteTaskOutput = void;

export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly analytics: IAnalyticsService,
  ) {}

  async execute(
    input: DeleteTaskInput,
  ): Promise<Result<DeleteTaskOutput, UseCaseError>> {
    // 1. Verify task exists
    const existsResult = await this.taskRepo.existsById(input.taskId);

    if (existsResult.isFailure) {
      return Result.fail(
        new RepositoryError(
          "Failed to check task existence",
          existsResult.error,
        ),
      );
    }

    if (!existsResult.value) {
      return Result.fail(new NotFoundError("Task not found", input.taskId));
    }

    // 2. Delete from repository
    const deleteResult = await this.taskRepo.delete(input.taskId);

    if (deleteResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to delete task", deleteResult.error),
      );
    }

    // 3. Publish domain event
    const event: DomainEvent = {
      type: "TaskDeleted",
      aggregateId: input.taskId,
      occurredAt: new Date(),
      data: {},
    };

    await this.eventPublisher.publish(event);

    // 4. Track analytics
    await this.analytics.trackEvent("task_deleted", {
      taskId: input.taskId,
    });

    return Result.ok(undefined);
  }
}
