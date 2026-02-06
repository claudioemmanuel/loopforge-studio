/**
 * FinalizePlanning Use Case
 * Transitions task from planning to ready phase
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

export interface FinalizePlanningInput {
  taskId: string;
}

export interface FinalizePlanningOutput {
  id: string;
  status: string;
  processingPhase: string | null;
}

export class FinalizePlanningUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: FinalizePlanningInput,
  ): Promise<Result<FinalizePlanningOutput, UseCaseError>> {
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

    // 2. Verify task is in planning phase
    const state = task.getState();
    if (state.status !== "planning") {
      return Result.fail(
        new BusinessRuleError(
          "INVALID_PHASE",
          "Task must be in planning phase to finalize",
        ),
      );
    }

    // 3. Verify plan exists
    if (!state.planContent) {
      return Result.fail(
        new BusinessRuleError(
          "MISSING_PLAN",
          "Task must have a plan before finalizing",
        ),
      );
    }

    // 4. Transition to ready
    try {
      const [updatedTask, event] = task.changeStatus("ready");

      // 5. Persist changes
      const saveResult = await this.taskRepo.save(updatedTask);
      if (saveResult.isFailure) {
        return Result.fail(
          new RepositoryError("Failed to save task", saveResult.error),
        );
      }

      // 6. Publish event
      await this.eventPublisher.publish(event);

      // 7. Map to output DTO
      const updatedState = updatedTask.getState();
      const output: FinalizePlanningOutput = {
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
}
