/**
 * CreateTask Use Case
 * Creates a new task in a repository
 */

import { Task } from "../../entities/Task";
import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import type { IAnalyticsService } from "../ports/IAnalyticsService";
import { Result } from "@/lib/shared/Result";
import {
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface CreateTaskInput {
  repoId: string;
  title: string;
  description: string;
  priority?: number;
}

export interface CreateTaskOutput {
  id: string;
  repoId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export class CreateTaskUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly analytics: IAnalyticsService,
  ) {}

  async execute(
    input: CreateTaskInput,
  ): Promise<Result<CreateTaskOutput, UseCaseError>> {
    // 1. Validate input
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      return Result.fail(new ValidationError(validation.errors));
    }

    // 2. Create entity (pure domain logic)
    const [task, event] = Task.create({
      id: this.generateId(),
      repoId: input.repoId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority ?? 0,
    });

    // 3. Persist via port
    const saveResult = await this.taskRepo.save(task);
    if (saveResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to save task", saveResult.error),
      );
    }

    // 4. Publish event via port
    const publishResult = await this.eventPublisher.publish(event);
    if (publishResult.isFailure) {
      // Log but don't fail (event publishing is not critical for task creation)
      console.error("Failed to publish TaskCreated event", publishResult.error);
    }

    // 5. Track analytics via port
    await this.analytics.trackEvent("task_created", {
      taskId: task.id,
      repoId: input.repoId,
    });

    // 6. Map to output DTO
    const state = task.getState();
    const output: CreateTaskOutput = {
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      createdAt: state.createdAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
    };

    return Result.ok(output);
  }

  private validateInput(input: CreateTaskInput): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    if (!input.repoId || input.repoId.trim() === "") {
      errors.repoId = ["Repository ID is required"];
    }

    if (!input.title || input.title.trim() === "") {
      errors.title = ["Title is required"];
    }

    if (input.title && input.title.length > 200) {
      errors.title = ["Title must be less than 200 characters"];
    }

    if (
      input.priority !== undefined &&
      (input.priority < 0 || input.priority > 10)
    ) {
      errors.priority = ["Priority must be between 0 and 10"];
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
