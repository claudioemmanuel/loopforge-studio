/**
 * ClaimExecutionSlot Use Case
 * Atomically claims a task for execution with dependency and plan guards
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

export interface ClaimExecutionSlotInput {
  taskId: string;
  workerId: string;
}

export interface ClaimExecutionSlotOutput {
  id: string;
  status: string;
  processingPhase: string | null;
  workerId: string;
}

export class ClaimExecutionSlotUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: ClaimExecutionSlotInput,
  ): Promise<Result<ClaimExecutionSlotOutput, UseCaseError>> {
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

    // 2. Attempt to claim execution slot (domain logic enforces guards)
    try {
      const [updatedTask, event] = task.claimForExecution(input.workerId);

      // 3. Persist changes
      const saveResult = await this.taskRepo.save(updatedTask);
      if (saveResult.isFailure) {
        return Result.fail(
          new RepositoryError("Failed to save task", saveResult.error),
        );
      }

      // 4. Publish event
      await this.eventPublisher.publish(event);

      // 5. Map to output DTO
      const state = updatedTask.getState();
      const output: ClaimExecutionSlotOutput = {
        id: state.id,
        status: state.status,
        processingPhase: state.processingPhase,
        workerId: input.workerId,
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
