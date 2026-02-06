import { NextResponse } from "next/server";
import { queuePlan } from "@/lib/queue";
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
  // Check if brainstorm result exists
  if (!task.brainstormResult) {
    return NextResponse.json(
      { error: "Cannot plan without brainstorm result" },
      { status: 400 },
    );
  }

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

    // ATOMIC: Claim the planning slot via use case
    const claimUseCase = UseCaseFactory.claimPlanningSlot();
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

    const taskService = getTaskService();

    // Update status to planning after slot claim
    await taskService.updateFields(taskId, {
      status: "planning",
      processingStartedAt: startedAt,
      processingStatusText: "Reviewing brainstorm...",
      updatedAt: startedAt,
    });

    // Record activity events
    const analyticsService = getAnalyticsService();
    await Promise.all([
      analyticsService.statusChanged({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: "planning",
      }),
      analyticsService.planningStarted({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
      }),
    ]);

    // Queue the background job
    const job = await queuePlan({
      taskId,
      userId: user.id,
      repoId: task.repoId,
      brainstormResult: task.brainstormResult,
      continueToExecution: task.autonomousMode,
      repoName: task.repo.name,
      repoFullName: task.repo.fullName,
      repoDefaultBranch: task.repo.defaultBranch || "main",
    });

    // Update with the job ID
    await taskService.updateFields(taskId, {
      processingJobId: job.id,
    });

    // Publish processing_start event
    const processingEvent = createProcessingEvent(
      "processing_start",
      taskId,
      task.title,
      task.repo.name,
      "planning",
      job.id!,
      startedAt,
      { statusText: "Reviewing brainstorm...", progress: 0 },
    );
    await publishProcessingEvent(user.id, processingEvent);

    // Return immediately with job info
    return NextResponse.json({
      queued: true,
      jobId: job.id,
      processingPhase: "planning",
    });
  } catch (error) {
    // Revert on error
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({
      taskId,
      revertToStatus: toDomainStatus(task.status),
    });

    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue plan",
    );
    return handleError(error);
  }
});
