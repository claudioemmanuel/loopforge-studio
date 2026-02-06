/**
 * CheckTaskTransitionValid Use Case
 * Validates whether a task can transition to a given status
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import { RepositoryError, UseCaseError } from "@/lib/shared/errors";
import type { TaskStatus } from "../../entities/value-objects";

export interface CheckTaskTransitionValidInput {
  taskId: string;
  toStatus: TaskStatus;
}

export interface CheckTaskTransitionValidOutput {
  isValid: boolean;
  reason?: string;
}

export class CheckTaskTransitionValidUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: CheckTaskTransitionValidInput,
  ): Promise<Result<CheckTaskTransitionValidOutput, UseCaseError>> {
    // 1. Fetch task
    const taskResult = await this.taskRepo.findById(input.taskId);

    if (taskResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch task", taskResult.error),
      );
    }

    const task = taskResult.value;

    // 2. If task doesn't exist, transition is invalid
    if (!task) {
      return Result.ok({
        isValid: false,
        reason: "Task not found",
      });
    }

    // 3. Check if transition is valid
    const canTransition = task.canTransitionTo(input.toStatus);

    if (!canTransition) {
      const state = task.getState();
      return Result.ok({
        isValid: false,
        reason: `Cannot transition from ${state.status} to ${input.toStatus}`,
      });
    }

    return Result.ok({ isValid: true });
  }
}
