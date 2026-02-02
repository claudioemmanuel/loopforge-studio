/**
 * POST /api/tasks/[taskId]/plan/start
 *
 * TODO (DDD Migration): Atomic claim + queue orchestration pattern.
 * Same complexity as brainstorm/start - needs Application Service layer.
 */
import { NextResponse } from "next/server";
import { db, tasks, buildStatusHistoryAppend } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { queuePlan } from "@/lib/queue";
import {
  publishProcessingEvent,
  createProcessingEvent,
} from "@/lib/workers/events";
import { withTask, getProviderApiKey, findConfiguredProvider } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import {
  createPlanningStartEvent,
  createStatusChangeEvent,
} from "@/lib/activity";

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

    // ATOMIC: Claim the processing slot first to prevent race conditions
    // This UPDATE only succeeds if processingPhase is NULL
    const claimResult = await db
      .update(tasks)
      .set({
        status: "planning",
        statusHistory: buildStatusHistoryAppend({
          fromStatus: task.status,
          toStatus: "planning",
          triggeredBy: "user",
          userId: user.id,
        }),
        processingPhase: "planning",
        processingStartedAt: startedAt,
        processingStatusText: "Reviewing brainstorm...",
        updatedAt: startedAt,
      })
      .where(and(eq(tasks.id, taskId), isNull(tasks.processingPhase)))
      .returning({ id: tasks.id });

    // If no rows were updated, another request already claimed the slot
    if (claimResult.length === 0) {
      return NextResponse.json(
        {
          error: "Task is already processing",
          phase: task.processingPhase || "unknown",
        },
        { status: 409 },
      );
    }

    // Create activity events for status change and planning start
    await Promise.all([
      createStatusChangeEvent({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: "planning",
      }),
      createPlanningStartEvent({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
      }),
    ]);

    // Now queue the job (we have exclusive processing rights)
    // Worker will decrypt API key on demand using userId
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
    // If queuing failed after claiming, reset the processing state
    await db
      .update(tasks)
      .set({
        status: task.status, // Restore original status
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
      })
      .where(eq(tasks.id, taskId));

    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue plan",
    );
    return handleError(error);
  }
});
