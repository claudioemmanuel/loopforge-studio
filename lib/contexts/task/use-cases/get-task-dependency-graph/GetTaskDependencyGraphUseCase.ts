/**
 * GetTaskDependencyGraph Use Case
 * Retrieves the full dependency graph for a task
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface GetTaskDependencyGraphInput {
  taskId: string;
}

export interface TaskNode {
  id: string;
  title: string;
  status: string;
  blockedByIds: string[];
}

export interface GetTaskDependencyGraphOutput {
  rootTask: TaskNode;
  dependencies: TaskNode[];
  dependents: TaskNode[];
}

export class GetTaskDependencyGraphUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: GetTaskDependencyGraphInput,
  ): Promise<Result<GetTaskDependencyGraphOutput, UseCaseError>> {
    // 1. Fetch root task
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

    const state = task.getState();

    // 2. Fetch all tasks in the same repository
    const allTasksResult = await this.taskRepo.findByRepo(state.repositoryId);

    if (allTasksResult.isFailure) {
      return Result.fail(
        new RepositoryError(
          "Failed to fetch repository tasks",
          allTasksResult.error,
        ),
      );
    }

    const allTasks = allTasksResult.value;

    // 3. Build dependency graph
    const dependencies: TaskNode[] = [];
    const dependents: TaskNode[] = [];

    // Find tasks that root task depends on
    for (const depId of state.blockedByIds) {
      const depTask = allTasks.find((t) => t.id === depId);
      if (depTask) {
        const depState = depTask.getState();
        dependencies.push({
          id: depState.id,
          title: depState.metadata.title,
          status: depState.status,
          blockedByIds: depState.blockedByIds,
        });
      }
    }

    // Find tasks that depend on root task
    for (const otherTask of allTasks) {
      const otherState = otherTask.getState();
      if (otherState.blockedByIds.includes(input.taskId)) {
        dependents.push({
          id: otherState.id,
          title: otherState.metadata.title,
          status: otherState.status,
          blockedByIds: otherState.blockedByIds,
        });
      }
    }

    // 4. Map to output DTO
    const output: GetTaskDependencyGraphOutput = {
      rootTask: {
        id: state.id,
        title: state.metadata.title,
        status: state.status,
        blockedByIds: state.blockedByIds,
      },
      dependencies,
      dependents,
    };

    return Result.ok(output);
  }
}
