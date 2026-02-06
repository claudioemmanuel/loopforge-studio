/**
 * UpdateTaskPriority Use Case
 * Updates the priority of a task
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

export interface UpdateTaskPriorityInput {
  taskId: string;
  priority: number;
}

export interface UpdateTaskPriorityOutput {
  id: string;
  priority: number;
}

export class UpdateTaskPriorityUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: UpdateTaskPriorityInput,
  ): Promise<Result<UpdateTaskPriorityOutput, UseCaseError>> {
    // 1. Validate input
    if (input.priority < 0 || input.priority > 10) {
      return Result.fail(
        new ValidationError({
          priority: ["Priority must be between 0 and 10"],
        }),
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

    // 3. Update priority via entity method
    const [updatedTask, event] = task.updatePriority(input.priority);

    // 4. Persist changes
    const saveResult = await this.taskRepo.save(updatedTask);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 5. Publish event
    if (event) {
      await this.eventPublisher.publish(event);
    }

    // 6. Map to output DTO
    const state = updatedTask.getState();
    const output: UpdateTaskPriorityOutput = {
      id: state.id,
      priority: state.metadata.priority,
    };

    return Result.ok(output);
  }
}
