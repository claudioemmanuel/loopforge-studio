/**
 * FinalizeBrainstorm Use Case
 * Transitions task from brainstorming to planning phase
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

export interface FinalizeBrainstormInput {
  taskId: string;
}

export interface FinalizeBrainstormOutput {
  id: string;
  status: string;
  processingPhase: string | null;
}

export class FinalizeBrainstormUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: FinalizeBrainstormInput,
  ): Promise<Result<FinalizeBrainstormOutput, UseCaseError>> {
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

    // 2. Verify task is in brainstorming phase
    const state = task.getState();
    if (state.status !== "brainstorming") {
      return Result.fail(
        new BusinessRuleError(
          "INVALID_PHASE",
          "Task must be in brainstorming phase to finalize",
        ),
      );
    }

    // 3. Transition to planning
    try {
      const [updatedTask, event] = task.changeStatus("planning");

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
      const output: FinalizeBrainstormOutput = {
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
