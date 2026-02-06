/**
 * UpdateTaskFields Use Case
 * Updates arbitrary task fields (title, description, priority, etc.)
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  ValidationError,
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface UpdateTaskFieldsInput {
  taskId: string;
  fields: {
    title?: string;
    description?: string;
    priority?: number;
  };
}

export interface UpdateTaskFieldsOutput {
  id: string;
  repoId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  updatedAt: string;
}

export class UpdateTaskFieldsUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: UpdateTaskFieldsInput,
  ): Promise<Result<UpdateTaskFieldsOutput, UseCaseError>> {
    // 1. Validate input
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      return Result.fail(new ValidationError(validation.errors));
    }

    // 2. Fetch existing task
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

    // 3. Update fields via entity method
    const [updatedTask, event] = task.updateFields(input.fields);

    // 4. Persist changes
    const saveResult = await this.taskRepo.save(updatedTask);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 5. Publish event
    if (event) {
      await this.eventPublisher.publish(event);
    }

    // 6. Map to output DTO
    const state = updatedTask.getState();
    const output: UpdateTaskFieldsOutput = {
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      updatedAt: state.updatedAt.toISOString(),
    };

    return Result.ok(output);
  }

  private validateInput(input: UpdateTaskFieldsInput): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    if (input.fields.title !== undefined) {
      if (input.fields.title.trim() === "") {
        errors.title = ["Title cannot be empty"];
      }
      if (input.fields.title.length > 200) {
        errors.title = ["Title must be less than 200 characters"];
      }
    }

    if (
      input.fields.priority !== undefined &&
      (input.fields.priority < 0 || input.fields.priority > 10)
    ) {
      errors.priority = ["Priority must be between 0 and 10"];
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
