import { NextResponse } from "next/server";
import { db, tasks, buildStatusHistoryAppend } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { queueBrainstorm } from "@/lib/queue";
import {
  publishProcessingEvent,
  createProcessingEvent,
} from "@/lib/workers/events";
import { withTask, getProviderApiKey, findConfiguredProvider } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

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

    // ATOMIC: Claim the processing slot first to prevent race conditions
    // This UPDATE only succeeds if processingPhase is NULL
    const claimResult = await db
      .update(tasks)
      .set({
        status: "brainstorming",
        statusHistory: buildStatusHistoryAppend({
          fromStatus: task.status,
          toStatus: "brainstorming",
          triggeredBy: "user",
          userId: user.id,
        }),
        processingPhase: "brainstorming",
        processingStartedAt: startedAt,
        processingStatusText: "Analyzing task...",
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

    // Now queue the job (we have exclusive processing rights)
    // Worker will decrypt API key on demand using userId
    const job = await queueBrainstorm({
      taskId,
      userId: user.id,
      repoId: task.repoId,
      continueToPlanning: task.autonomousMode,
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
      "Failed to queue brainstorm",
    );
    return handleError(error);
  }
});
