/**
 * MarkTaskRunning Use Case
 * Transitions task to executing status
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

export interface MarkTaskRunningInput {
  taskId: string;
  executionId: string;
}

export interface MarkTaskRunningOutput {
  id: string;
  status: string;
  executionId: string;
}

export class MarkTaskRunningUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: MarkTaskRunningInput,
  ): Promise<Result<MarkTaskRunningOutput, UseCaseError>> {
    // 1. Validate input
    if (!input.executionId || input.executionId.trim() === "") {
      return Result.fail(
        new ValidationError({ executionId: ["Execution ID is required"] }),
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

    // 3. Mark as running via entity method
    const [updatedTask, event] = task.markAsRunning(input.executionId);

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
    const output: MarkTaskRunningOutput = {
      id: input.taskId,
      status: "executing",
      executionId: input.executionId,
    };

    return Result.ok(output);
  }
}
