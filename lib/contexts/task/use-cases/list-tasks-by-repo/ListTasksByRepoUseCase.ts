/**
 * ListTasksByRepo Use Case
 * Retrieves all tasks for a given repository with optional filtering
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import { RepositoryError, UseCaseError } from "@/lib/shared/errors";
import type { TaskStatus } from "../../entities/value-objects";

export interface ListTasksByRepoInput {
  repoId: string;
  filters?: {
    status?: TaskStatus;
    priority?: number;
  };
}

export interface TaskListItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  processingPhase: string | null;
  blockedByIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListTasksByRepoOutput {
  tasks: TaskListItem[];
  total: number;
}

export class ListTasksByRepoUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: ListTasksByRepoInput,
  ): Promise<Result<ListTasksByRepoOutput, UseCaseError>> {
    // 1. Fetch tasks from repository
    const tasksResult = await this.taskRepo.findByRepo(input.repoId);

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

    if (input.filters?.priority !== undefined) {
      tasks = tasks.filter(
        (t) => t.getState().metadata.priority === input.filters?.priority,
      );
    }

    // 3. Map to output DTOs
    const taskItems: TaskListItem[] = tasks.map((task) => {
      const state = task.getState();
      return {
        id: state.id,
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

    const output: ListTasksByRepoOutput = {
      tasks: taskItems,
      total: taskItems.length,
    };

    return Result.ok(output);
  }
}
