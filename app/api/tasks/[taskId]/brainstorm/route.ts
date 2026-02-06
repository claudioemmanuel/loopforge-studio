/**
 * POST /api/tasks/[taskId]/brainstorm
 * Generate brainstorm result synchronously (not background job)
 */
import { NextResponse } from "next/server";
import { brainstormTask, createAIClient } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { apiLogger } from "@/lib/logger";
import type { TaskStatus } from "@/lib/contexts/task/entities/value-objects";

function toDomainStatus(status: string): TaskStatus {
  const allowed: TaskStatus[] = [
    "todo",
    "brainstorming",
    "planning",
    "ready",
    "executing",
    "done",
    "stuck",
  ];

  if (allowed.includes(status as TaskStatus)) {
    return status as TaskStatus;
  }

  return "todo";
}

export const POST = withTask(async (request, { user, task, taskId }) => {
  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  try {
    const client = await createAIClient(
      config.provider,
      config.apiKey,
      config.model,
    );

    // ATOMIC: Claim the brainstorming slot via use case
    const claimUseCase = UseCaseFactory.claimBrainstormingSlot();
    const claimResult = await claimUseCase.execute({
      taskId,
      workerId: user.id,
    });

    if (claimResult.isFailure) {
      return NextResponse.json(
        {
          error: "Task is already processing",
          phase: task.processingPhase || "unknown",
        },
        { status: 409 },
      );
    }

    // Run brainstorm
    const result = await brainstormTask(client, task.title, task.description);

    // Save brainstorm result via use case
    const saveBrainstormUseCase = UseCaseFactory.saveBrainstormResult();
    const brainstormResult = {
      summary: JSON.stringify(result, null, 2),
      conversation: [],
      messageCount: 0,
      compactedAt: null,
    };

    const saveResult = await saveBrainstormUseCase.execute({
      taskId,
      result: brainstormResult,
    });

    if (saveResult.isFailure) {
      return handleError(saveResult.error);
    }

    // Clear processing slot after successful save
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({
      taskId,
      revertToStatus: toDomainStatus(task.status),
    });

    // Fetch updated task
    const getTaskUseCase = UseCaseFactory.getTaskWithRepo();
    const taskResult = await getTaskUseCase.execute({ taskId });

    if (taskResult.isFailure) {
      return handleError(taskResult.error);
    }

    // Verify task is still in brainstorming status
    if (taskResult.value.status !== "brainstorming") {
      apiLogger.warn(
        { taskId },
        "Task state changed during processing, discarding result",
      );
      return NextResponse.json(
        { error: "Task state changed during processing" },
        { status: 409 },
      );
    }

    return NextResponse.json(taskResult.value);
  } catch (error) {
    apiLogger.error(
      {
        taskId,
        provider: config.provider,
        model: config.model,
        error: error instanceof Error ? error.message : String(error),
      },
      "Brainstorm error",
    );

    // Revert status and clear processing state on error
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({ taskId, revertToStatus: "todo" });

    return handleError(error);
  }
});
