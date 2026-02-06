import { NextResponse } from "next/server";
import { db, tasks, buildStatusHistoryAppend } from "@/lib/db";
import { eq } from "drizzle-orm";
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

    // Update status to planning (direct DB for now as use case doesn't handle this)
    await db
      .update(tasks)
      .set({
        status: "planning",
        statusHistory: buildStatusHistoryAppend({
          fromStatus: task.status,
          toStatus: "planning",
          triggeredBy: "user",
          userId: user.id,
        }),
        processingStartedAt: startedAt,
        processingStatusText: "Reviewing brainstorm...",
        updatedAt: startedAt,
      })
      .where(eq(tasks.id, taskId));

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
    await db
      .update(tasks)
      .set({
        processingJobId: job.id,
      })
      .where(eq(tasks.id, taskId));

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
    await clearUseCase.execute({ taskId, revertToStatus: task.status });

    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue plan",
    );
    return handleError(error);
  }
});
