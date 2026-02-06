import { NextResponse } from "next/server";
import { queueBrainstorm } from "@/lib/queue";
import {
  publishProcessingEvent,
  createProcessingEvent,
} from "@/lib/workers/events";
import { withTask, getProviderApiKey, findConfiguredProvider } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { getTaskService } from "@/lib/contexts/task/api";
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
  // Find a configured provider
  const aiProvider = findConfiguredProvider(user);
  if (!aiProvider) {
    return handleError(Errors.noProviderConfigured());
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return handleError(Errors.authError(aiProvider));
  }

  try {
    const startedAt = new Date();

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

    // Record activity events
    const analyticsService = getAnalyticsService();
    await Promise.all([
      analyticsService.statusChanged({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: "brainstorming",
      }),
      analyticsService.brainstormStarted({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
      }),
    ]);

    // Now queue the job (we have exclusive processing rights)
    // Worker will decrypt API key on demand using userId
    const job = await queueBrainstorm({
      taskId,
      userId: user.id,
      repoId: task.repoId,
      continueToPlanning: task.autonomousMode,
    });

    // Update with the job ID
    const taskService = getTaskService();
    await taskService.updateFields(taskId, {
      processingJobId: job.id,
    });

    // Publish processing_start event
    const processingEvent = createProcessingEvent(
      "processing_start",
      taskId,
      task.title,
      task.repo.name,
      "brainstorming",
      job.id!,
      startedAt,
      { statusText: "Analyzing task...", progress: 0 },
    );
    await publishProcessingEvent(user.id, processingEvent);

    // Return immediately with job info
    return NextResponse.json({
      queued: true,
      jobId: job.id,
      processingPhase: "brainstorming",
    });
  } catch (error) {
    // Revert brainstorming slot on error via use case
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({
      taskId,
      revertToStatus: toDomainStatus(task.status),
    });

    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue brainstorm",
    );
    return handleError(error);
  }
});
