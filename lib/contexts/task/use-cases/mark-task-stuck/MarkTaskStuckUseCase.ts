/**
 * MarkTaskStuck Use Case
 * Marks task as stuck with reason
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

export interface MarkTaskStuckInput {
  taskId: string;
  reason: string;
}

export interface MarkTaskStuckOutput {
  id: string;
  status: string;
  reason: string;
}

export class MarkTaskStuckUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: MarkTaskStuckInput,
  ): Promise<Result<MarkTaskStuckOutput, UseCaseError>> {
    // 1. Validate input
    if (!input.reason || input.reason.trim() === "") {
      return Result.fail(
        new ValidationError({ reason: ["Reason is required"] }),
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

    // 3. Mark as stuck via entity method
    const [updatedTask, event] = task.markAsStuck(input.reason);

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
    const output: MarkTaskStuckOutput = {
      id: input.taskId,
      status: "stuck",
      reason: input.reason,
    };

    return Result.ok(output);
  }
}
