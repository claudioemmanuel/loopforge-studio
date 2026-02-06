/**
 * ClearProcessingSlot Use Case
 * Releases a task's processing slot (reverts to previous status)
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  BusinessRuleError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";
import type { TaskStatus } from "../../entities/value-objects";

export interface ClearProcessingSlotInput {
  taskId: string;
  revertToStatus?: TaskStatus;
}

export interface ClearProcessingSlotOutput {
  id: string;
  status: string;
  processingPhase: string | null;
}

export class ClearProcessingSlotUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: ClearProcessingSlotInput,
  ): Promise<Result<ClearProcessingSlotOutput, UseCaseError>> {
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

    // 2. Determine target status
    const state = task.getState();
    const targetStatus =
      input.revertToStatus ?? this.getRevertStatus(state.status);

    // 3. Transition to target status
    try {
      const [updatedTask, event] = task.changeStatus(targetStatus);

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
      const updatedState = updatedTask.getState();
      const output: ClearProcessingSlotOutput = {
        id: updatedState.id,
        status: updatedState.status,
        processingPhase: updatedState.processingPhase,
      };

      return Result.ok(output);
    } catch (error) {
      if (error instanceof BusinessRuleError) {
        return Result.fail(error);
      }
      throw error;
    }
  }

  private getRevertStatus(currentStatus: TaskStatus): TaskStatus {
    // Revert to previous logical status
    switch (currentStatus) {
      case "brainstorming":
      case "planning":
        return "todo";
      case "executing":
        return "ready";
      default:
        return currentStatus;
    }
  }
}
