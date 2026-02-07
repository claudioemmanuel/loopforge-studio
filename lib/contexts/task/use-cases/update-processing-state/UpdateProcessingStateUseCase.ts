/**
 * UpdateProcessingState Use Case
 * Updates task processing metadata (jobId, startedAt, statusText)
 * Used after claiming brainstorming/planning/execution slots
 */

import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface UpdateProcessingStateInput {
  taskId: string;
  processingJobId?: string;
  processingStartedAt?: Date;
  processingStatusText?: string;
  status?: "brainstorming" | "planning" | "executing";
  planContent?: string | null;
  branch?: string | null;
  executionGraph?: unknown;
}

export interface UpdateProcessingStateOutput {
  id: string;
  status: string;
  processingJobId: string | null;
  processingStartedAt: string | null;
  processingStatusText: string | null;
}

export class UpdateProcessingStateUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: UpdateProcessingStateInput,
  ): Promise<Result<UpdateProcessingStateOutput, UseCaseError>> {
    // 1. Fetch existing task
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

    // 2. Build update object for processing metadata
    const updates: Record<string, unknown> = {};
    if (input.processingJobId !== undefined)
      updates.processingJobId = input.processingJobId;
    if (input.processingStartedAt !== undefined)
      updates.processingStartedAt = input.processingStartedAt;
    if (input.processingStatusText !== undefined)
      updates.processingStatusText = input.processingStatusText;
    if (input.status !== undefined) updates.status = input.status;
    if (input.planContent !== undefined)
      updates.planContent = input.planContent;
    if (input.branch !== undefined) updates.branch = input.branch;
    if (input.executionGraph !== undefined)
      updates.executionGraph = input.executionGraph;
    updates.updatedAt = new Date();

    // 3. Update task via entity method
    const [updatedTask, event] = task.updateFields(updates);

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
    const output: UpdateProcessingStateOutput = {
      id: state.id,
      status: state.status,
      processingJobId: input.processingJobId ?? null,
      processingStartedAt: input.processingStartedAt?.toISOString() ?? null,
      processingStatusText: input.processingStatusText ?? null,
    };

    return Result.ok(output);
  }
}
