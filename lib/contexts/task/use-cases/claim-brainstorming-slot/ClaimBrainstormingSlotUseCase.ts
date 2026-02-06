/**
 * ClaimBrainstormingSlot Use Case
 * Atomically claims a task for brainstorming phase
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

export interface ClaimBrainstormingSlotInput {
  taskId: string;
  workerId: string;
}

export interface ClaimBrainstormingSlotOutput {
  id: string;
  status: string;
  processingPhase: string | null;
  workerId: string;
}

export class ClaimBrainstormingSlotUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: ClaimBrainstormingSlotInput,
  ): Promise<Result<ClaimBrainstormingSlotOutput, UseCaseError>> {
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

    // 2. Attempt to claim brainstorming slot (domain logic enforces rules)
    try {
      const [updatedTask, event] = task.startBrainstorming(input.workerId);

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
      const output: ClaimBrainstormingSlotOutput = {
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
