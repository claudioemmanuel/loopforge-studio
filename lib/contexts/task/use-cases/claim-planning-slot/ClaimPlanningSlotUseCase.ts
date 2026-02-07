/**
 * ClaimPlanningSlot Use Case
 * Atomically claims a task for planning phase
 */

import { randomUUID } from "crypto";
import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IEventPublisher } from "../ports/IEventPublisher";
import { Result } from "@/lib/shared/Result";
import {
  NotFoundError,
  BusinessRuleError,
  RepositoryError,
  UseCaseError,
} from "@/lib/shared/errors";

export interface ClaimPlanningSlotInput {
  taskId: string;
  workerId: string;
}

export interface ClaimPlanningSlotOutput {
  id: string;
  status: string;
  processingPhase: string | null;
  workerId: string;
}

export class ClaimPlanningSlotUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(
    input: ClaimPlanningSlotInput,
  ): Promise<Result<ClaimPlanningSlotOutput, UseCaseError>> {
    // 1. Fetch task
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

    // 2. Verify task is in planning phase
    const state = task.getState();
    if (state.status !== "planning") {
      return Result.fail(
        new BusinessRuleError(
          "INVALID_PHASE",
          "Task must be in planning phase to claim",
        ),
      );
    }

    // 3. Transition remains in planning but marks as claimed (via processingPhase)
    // Task is already in planning status, just need to persist worker claim
    const output: ClaimPlanningSlotOutput = {
      id: state.id,
      status: state.status,
      processingPhase: state.processingPhase,
      workerId: input.workerId,
    };

    // 4. Emit planning started event
    const event = {
      id: randomUUID(),
      eventType: "PlanningStarted",
      aggregateId: task.id,
      aggregateType: "Task",
      occurredAt: new Date(),
      data: { workerId: input.workerId },
    };

    await this.eventPublisher.publish(event);

    return Result.ok(output);
  }
}
