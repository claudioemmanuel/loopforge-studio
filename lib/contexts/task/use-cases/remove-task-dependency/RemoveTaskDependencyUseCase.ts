/**
 * RemoveTaskDependency Use Case
 * Removes a dependency relationship between tasks
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface RemoveTaskDependencyInput {
  taskId: string;
  dependsOnId: string;
}

export interface RemoveTaskDependencyOutput {
  id: string;
  blockedByIds: string[];
}

export class RemoveTaskDependencyUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: RemoveTaskDependencyInput,
  ): Promise<Result<RemoveTaskDependencyOutput, UseCaseError>> {
    // 1. Fetch task
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

    // 2. Remove dependency via entity method
    const [updatedTask, event] = task.removeDependency(input.dependsOnId);

    // 3. Persist changes
    const saveResult = await this.taskRepo.save(updatedTask);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 4. Publish event
    if (event) {
      await this.eventPublisher.publish(event);
    }

    // 5. Map to output DTO
    const state = updatedTask.getState();
    const output: RemoveTaskDependencyOutput = {
      id: state.id,
      blockedByIds: state.blockedByIds,
    };

    return Result.ok(output);
  }
}
