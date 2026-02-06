/**
 * VerifyTaskOwnership Use Case
 * Verifies that a user owns a task (via repository ownership)
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import { Result } from "@/lib/shared/Result";
import { RepositoryError, UseCaseError } from "@/lib/shared/errors";
import { db } from "@/lib/db";
import { repos } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";

export interface VerifyTaskOwnershipInput {
  taskId: string;
  userId: string;
}

export interface VerifyTaskOwnershipOutput {
  isOwner: boolean;
}

export class VerifyTaskOwnershipUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(
    input: VerifyTaskOwnershipInput,
  ): Promise<Result<VerifyTaskOwnershipOutput, UseCaseError>> {
    // 1. Fetch task
    const taskResult = await this.taskRepo.findById(input.taskId);

    if (taskResult.isFailure) {
      return Result.fail(
        new RepositoryError("Failed to fetch task", taskResult.error),
      );
    }

    const task = taskResult.value;

    // 2. If task doesn't exist, user doesn't own it
    if (!task) {
      return Result.ok({ isOwner: false });
    }

    const state = task.getState();

    // 3. Fetch repository to verify ownership
    try {
      const repo = await db.query.repos.findFirst({
        where: eq(repos.id, state.repositoryId),
      });

      if (!repo) {
        return Result.ok({ isOwner: false });
      }

      // 4. Check ownership
      const isOwner = repo.userId === input.userId;

      return Result.ok({ isOwner });
    } catch (error) {
      return Result.fail(
        new RepositoryError("Failed to verify ownership", error),
      );
    }
  }
}
