/**
 * MarkTaskFailed Use Case
 * Marks task execution as failed with error details
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface MarkTaskFailedInput {
  taskId: string;
  error: string;
}

export interface MarkTaskFailedOutput {
  id: string;
  status: string;
  error: string;
}

export class MarkTaskFailedUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: MarkTaskFailedInput,
  ): Promise<Result<MarkTaskFailedOutput, UseCaseError>> {
    // 1. Validate input
    if (!input.error || input.error.trim() === "") {
      return Result.fail(
        new ValidationError({ error: ["Error message is required"] }),
      );
    }

    // 2. Fetch task
    const taskResult = await this.taskRepo.findById(input.taskId);

    if (taskResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch task", taskResult.error),
      );
    }

    const task = taskResult.value;

    if (!task) {
      return Result.fail(new NotFoundError("Task not found", input.taskId));
    }

    // 3. Mark as failed via entity method
    const [updatedTask, event] = task.markAsFailed(input.error);

    // 4. Persist changes
    const saveResult = await this.taskRepo.save(updatedTask);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 5. Publish event
    await this.eventPublisher.publish(event);

    // 6. Map to output DTO
    const state = updatedTask.getState();
    const output: MarkTaskFailedOutput = {
      id: state.id,
      status: state.status,
      error: input.error,
    };

    return Result.ok(output);
  }
}
