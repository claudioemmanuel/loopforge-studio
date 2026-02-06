/**
 * ListTasksByUser Use Case
 * Retrieves all tasks for a given user across all repositories
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import { RepositoryError, UseCaseError } from "@/lib/shared/errors";
import type { TaskStatus } from "../../entities/value-objects";

export interface ListTasksByUserInput {
  userId: string;
  filters?: {
    status?: TaskStatus;
    repoId?: string;
  };
}

export interface TaskListItem {
  id: string;
  repoId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  processingPhase: string | null;
  blockedByIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListTasksByUserOutput {
  tasks: TaskListItem[];
  total: number;
}

export class ListTasksByUserUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: ListTasksByUserInput,
  ): Promise<Result<ListTasksByUserOutput, UseCaseError>> {
    // 1. Fetch tasks from repository
    const tasksResult = await this.taskRepo.findByUser(input.userId);

    if (tasksResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch tasks", tasksResult.error),
      );
    }

    let tasks = tasksResult.value;

    // 2. Apply filters
    if (input.filters?.status) {
      tasks = tasks.filter(
        (t) => t.getState().status === input.filters?.status,
      );
    }

    if (input.filters?.repoId) {
      tasks = tasks.filter(
        (t) => t.getState().repositoryId === input.filters?.repoId,
      );
    }

    // 3. Map to output DTOs
    const taskItems: TaskListItem[] = tasks.map((task) => {
      const state = task.getState();
      return {
        id: state.id,
        repoId: state.repositoryId,
        title: state.metadata.title,
        description: state.metadata.description,
        status: state.status,
        priority: state.metadata.priority,
        processingPhase: state.processingPhase,
        blockedByIds: state.blockedByIds,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
      };
    });

    const output: ListTasksByUserOutput = {
      tasks: taskItems,
      total: taskItems.length,
    };

    return Result.ok(output);
  }
}
