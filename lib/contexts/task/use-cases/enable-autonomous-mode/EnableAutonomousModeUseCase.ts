/**
 * EnableAutonomousMode Use Case
 * Toggles autonomous mode for a task
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface EnableAutonomousModeInput {
  taskId: string;
  enabled: boolean;
}

export interface EnableAutonomousModeOutput {
  id: string;
  autonomousMode: boolean;
}

export class EnableAutonomousModeUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: EnableAutonomousModeInput,
  ): Promise<Result<EnableAutonomousModeOutput, UseCaseError>> {
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

    // 2. Update autonomous mode via entity method
    const [updatedTask, event] = task.setAutonomousMode(input.enabled);

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
    const output: EnableAutonomousModeOutput = {
      id: state.id,
      autonomousMode: state.configuration.autonomousMode,
    };

    return Result.ok(output);
  }
}
