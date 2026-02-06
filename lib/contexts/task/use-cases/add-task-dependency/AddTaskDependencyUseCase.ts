/**
 * AddTaskDependency Use Case
 * Adds a dependency relationship between tasks
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface AddTaskDependencyInput {
  taskId: string;
  dependsOnId: string;
}

export interface AddTaskDependencyOutput {
  id: string;
  blockedByIds: string[];
}

export class AddTaskDependencyUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: AddTaskDependencyInput,
  ): Promise<Result<AddTaskDependencyOutput, UseCaseError>> {
    // 1. Validate input
    if (input.taskId === input.dependsOnId) {
      return Result.fail(
        new ValidationError({
          dependsOnId: ["Task cannot depend on itself"],
        }),
      );
    }

    // 2. Fetch both tasks
    const [taskResult, dependencyResult] = await Promise.all([
      this.taskRepo.findById(input.taskId),
      this.taskRepo.findById(input.dependsOnId),
    ]);

    if (taskResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch task", taskResult.error),
      );
    }

    if (dependencyResult.isFailure) {
      return Result.fail(
        new RepositoryError(
          "Failed to fetch dependency task",
          dependencyResult.error,
        ),
      );
    }

    const task = taskResult.value;
    const dependencyTask = dependencyResult.value;

    if (!task) {
      return Result.fail(new NotFoundError("Task not found", input.taskId));
    }

    if (!dependencyTask) {
      return Result.fail(
        new NotFoundError("Dependency task not found", input.dependsOnId),
      );
    }

    // 3. Verify tasks are in same repository
    if (
      task.getState().repositoryId !== dependencyTask.getState().repositoryId
    ) {
      return Result.fail(
        new BusinessRuleError(
          "CROSS_REPO_DEPENDENCY",
          "Tasks must be in the same repository",
        ),
      );
    }

    // 4. Add dependency via entity method
    const [updatedTask, event] = task.addDependency(input.dependsOnId);

    // 5. Persist changes
    const saveResult = await this.taskRepo.save(updatedTask);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 6. Publish event
    if (event) {
      await this.eventPublisher.publish(event);
    }

    // 7. Map to output DTO
    const state = updatedTask.getState();
    const output: AddTaskDependencyOutput = {
      id: state.id,
      blockedByIds: state.blockedByIds,
    };

    return Result.ok(output);
  }
}
