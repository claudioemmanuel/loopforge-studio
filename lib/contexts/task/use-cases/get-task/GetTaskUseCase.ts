/**
 * GetTask Use Case
 * Retrieves a single task by ID
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface GetTaskInput {
  taskId: string;
}

export interface GetTaskOutput {
  id: string;
  repoId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  processingPhase: string | null;
  brainstormSummary: string | null;
  planContent: string | null;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  autonomousMode: boolean;
  autoApprove: boolean;
  blockedByIds: string[];
  createdAt: string;
  updatedAt: string;
}

export class GetTaskUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: GetTaskInput,
  ): Promise<Result<GetTaskOutput, UseCaseError>> {
    // 1. Fetch from repository
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

    // 2. Map to output DTO
    const state = task.getState();
    const output: GetTaskOutput = {
      id: state.id,
      repoId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      processingPhase: state.processingPhase,
      brainstormSummary: state.brainstormResult?.summary ?? null,
      planContent: state.planContent,
      branch: state.executionResult?.branchName ?? null,
      prUrl: state.executionResult?.prUrl ?? null,
      prNumber: state.executionResult?.prNumber ?? null,
      autonomousMode: state.configuration.autonomousMode,
      autoApprove: state.configuration.autoApprove,
      blockedByIds: state.blockedByIds,
      createdAt: state.createdAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
    };

    return Result.ok(output);
  }
}
