/**
 * GetTaskIdsByRepoIds Use Case
 * Bulk retrieves task IDs for given repository IDs
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import {
  ValidationError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface GetTaskIdsByRepoIdsInput {
  repoIds: string[];
}

export interface GetTaskIdsByRepoIdsOutput {
  taskIds: string[];
  count: number;
}

export class GetTaskIdsByRepoIdsUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: GetTaskIdsByRepoIdsInput,
  ): Promise<Result<GetTaskIdsByRepoIdsOutput, UseCaseError>> {
    // 1. Validate input
    if (!Array.isArray(input.repoIds) || input.repoIds.length === 0) {
      return Result.fail(
        new ValidationError({
          repoIds: ["At least one repository ID is required"],
        }),
      );
    }

    // 2. Get task IDs
    const taskIdsResult = await this.taskRepo.getIdsByRepoIds(input.repoIds);

    if (taskIdsResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch task IDs", taskIdsResult.error),
      );
    }

    const taskIds = taskIdsResult.value;

    // 3. Map to output DTO
    const output: GetTaskIdsByRepoIdsOutput = {
      taskIds,
      count: taskIds.length,
    };

    return Result.ok(output);
  }
}
