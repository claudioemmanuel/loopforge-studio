/**
 * SaveBrainstormResult Use Case
 * Saves brainstorming conversation and summary to task
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";
import type { BrainstormResult } from "../../entities/Task";

export interface SaveBrainstormResultInput {
  taskId: string;
  result: BrainstormResult;
}

export interface SaveBrainstormResultOutput {
  id: string;
  summary: string;
  messageCount: number;
}

export class SaveBrainstormResultUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: SaveBrainstormResultInput,
  ): Promise<Result<SaveBrainstormResultOutput, UseCaseError>> {
    // 1. Validate input
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      return Result.fail(new ValidationError(validation.errors));
    }

    // 2. Fetch task
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

    // 3. Save brainstorm result via entity method
    const [updatedTask, event] = task.completeBrainstorming(input.result);

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
    const output: SaveBrainstormResultOutput = {
      id: input.taskId,
      summary: input.result.summary,
      messageCount: input.result.messageCount,
    };

    return Result.ok(output);
  }

  private validateInput(input: SaveBrainstormResultInput): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    if (!input.result.summary || input.result.summary.trim() === "") {
      errors.summary = ["Brainstorm summary is required"];
    }

    if (!Array.isArray(input.result.conversation)) {
      errors.conversation = ["Conversation must be an array"];
    }

    if (input.result.messageCount < 0) {
      errors.messageCount = ["Message count must be non-negative"];
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
