/**
 * SavePlan Use Case
 * Saves execution plan to task
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

export interface SavePlanInput {
  taskId: string;
  plan: string;
}

export interface SavePlanOutput {
  id: string;
  planLength: number;
}

export class SavePlanUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: SavePlanInput,
  ): Promise<Result<SavePlanOutput, UseCaseError>> {
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

    // 3. Save plan via entity method
    const [updatedTask, event] = task.savePlan(input.plan);

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
    const output: SavePlanOutput = {
      id: input.taskId,
      planLength: input.plan.length,
    };

    return Result.ok(output);
  }

  private validateInput(input: SavePlanInput): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    if (!input.plan || input.plan.trim() === "") {
      errors.plan = ["Plan content is required"];
    }

    if (input.plan && input.plan.length < 50) {
      errors.plan = ["Plan must be at least 50 characters"];
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
