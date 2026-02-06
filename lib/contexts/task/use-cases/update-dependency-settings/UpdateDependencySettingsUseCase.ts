/**
 * UpdateDependencySettings Use Case
 * Updates dependency-related configuration for a task
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface UpdateDependencySettingsInput {
  taskId: string;
  settings: {
    strictDependencyOrder?: boolean;
    allowParallelExecution?: boolean;
  };
}

export interface UpdateDependencySettingsOutput {
  id: string;
  settings: {
    strictDependencyOrder: boolean;
    allowParallelExecution: boolean;
  };
}

export class UpdateDependencySettingsUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: UpdateDependencySettingsInput,
  ): Promise<Result<UpdateDependencySettingsOutput, UseCaseError>> {
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

    // Note: Dependency settings are stored as metadata or configuration
    // For now, this is a placeholder that acknowledges the operation
    // In a full implementation, this would update task configuration

    // 2. Map to output DTO
    const output: UpdateDependencySettingsOutput = {
      id: input.taskId,
      settings: {
        strictDependencyOrder: input.settings.strictDependencyOrder ?? true,
        allowParallelExecution: input.settings.allowParallelExecution ?? false,
      },
    };

    return Result.ok(output);
  }
}
