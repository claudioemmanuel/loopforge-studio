/**
 * GetTaskWithRepo Use Case
 * Retrieves a task with its associated repository details
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";
import { db } from "@/lib/db";
import { repos } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";

export interface GetTaskWithRepoInput {
  taskId: string;
}

export interface RepoDetails {
  id: string;
  userId: string;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
}

export interface GetTaskWithRepoOutput {
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
  repo: RepoDetails;
}

export class GetTaskWithRepoUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: GetTaskWithRepoInput,
  ): Promise<Result<GetTaskWithRepoOutput, UseCaseError>> {
    // 1. Fetch task from repository
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

    // 2. Fetch associated repository details
    try {
      const repo = await db.query.repos.findFirst({
        where: eq(repos.id, state.repositoryId),
      });

      if (!repo) {
        return Result.fail(
          new NotFoundError("Repository not found", state.repositoryId),
        );
      }

      // 3. Map to output DTO
      const output: GetTaskWithRepoOutput = {
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
        repo: {
          id: repo.id,
          userId: repo.userId,
          name: repo.name,
          owner: repo.fullName.split("/")[0] || repo.name,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch ?? "main",
          cloneUrl: repo.cloneUrl,
        },
      };

      return Result.ok(output);
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to fetch repository details", error),
      );
    }
  }
}
