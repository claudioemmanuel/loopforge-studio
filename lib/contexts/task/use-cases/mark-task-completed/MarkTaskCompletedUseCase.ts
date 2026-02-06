/**
 * MarkTaskCompleted Use Case
 * Transitions task to done status with execution result
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import type { IAnalyticsService } from "../ports/IAnalyticsService";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";
import type { ExecutionResult } from "../../entities/Task";

export interface MarkTaskCompletedInput {
  taskId: string;
  result: ExecutionResult;
}

export interface MarkTaskCompletedOutput {
  id: string;
  status: string;
  branchName: string;
  prUrl?: string;
}

export class MarkTaskCompletedUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly analytics: IAnalyticsService,
  ) {}

  async execute(
    input: MarkTaskCompletedInput,
  ): Promise<Result<MarkTaskCompletedOutput, UseCaseError>> {
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

    // 3. Mark as completed via entity method
    const [updatedTask, event] = task.markAsCompleted(input.result);

    // 4. Persist changes
    const saveResult = await this.taskRepo.save(updatedTask);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 5. Publish event
    await this.eventPublisher.publish(event);

    // 6. Track analytics
    await this.analytics.trackEvent("task_completed", {
      taskId: input.taskId,
      hasPr: !!input.result.prUrl,
    });

    // 7. Map to output DTO
    const output: MarkTaskCompletedOutput = {
      id: input.taskId,
      status: "done",
      branchName: input.result.branchName,
      prUrl: input.result.prUrl ?? undefined,
    };

    return Result.ok(output);
  }

  private validateInput(input: MarkTaskCompletedInput): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    if (!input.result.branchName || input.result.branchName.trim() === "") {
      errors.branchName = ["Branch name is required"];
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
