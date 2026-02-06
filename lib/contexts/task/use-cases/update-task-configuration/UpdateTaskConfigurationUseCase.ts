/**
 * UpdateTaskConfiguration Use Case
 * Updates task configuration (autonomousMode, autoApprove, etc.)
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";
import type { TaskConfiguration } from "../../entities/value-objects";

export interface UpdateTaskConfigurationInput {
  taskId: string;
  config: Partial<TaskConfiguration>;
}

export interface UpdateTaskConfigurationOutput {
  id: string;
  configuration: TaskConfiguration;
}

export class UpdateTaskConfigurationUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: UpdateTaskConfigurationInput,
  ): Promise<Result<UpdateTaskConfigurationOutput, UseCaseError>> {
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

    // 2. Update configuration via entity method
    const [updatedTask, event] = task.updateConfiguration(input.config);

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
    const output: UpdateTaskConfigurationOutput = {
      id: state.id,
      configuration: state.configuration,
    };

    return Result.ok(output);
  }
}
