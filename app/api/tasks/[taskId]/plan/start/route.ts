/**
 * POST /api/tasks/[taskId]/plan/start
 *
 * TODO (DDD Migration): Atomic claim + queue orchestration pattern.
 * Same complexity as brainstorm/start - needs Application Service layer.
 */
import { NextResponse } from "next/server";
import { queuePlan } from "@/lib/queue";
import {
  publishProcessingEvent,
  createProcessingEvent,
} from "@/lib/workers/events";
import { withTask, getProviderApiKey, findConfiguredProvider } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getTaskService } from "@/lib/contexts/task/api";

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

  let job: Awaited<ReturnType<typeof queuePlan>> | undefined;

  try {
    const startedAt = new Date();
    const taskService = getTaskService();

    // Now queue the job (we have exclusive processing rights)
    // Worker will decrypt API key on demand using userId
    job = await queuePlan({
      taskId,
      userId: user.id,
      repoId: task.repoId,
      brainstormResult: task.brainstormResult,
      continueToExecution: task.autonomousMode,
      repoName: task.repo.name,
      repoFullName: task.repo.fullName,
      repoDefaultBranch: task.repo.defaultBranch || "main",
    });

    await taskService.startPlanning({
      taskId,
      jobId: String(job.id),
    });

    // Publish processing_start event
    const processingEvent = createProcessingEvent(
      "processing_start",
      taskId,
      task.title,
      task.repo.name,
      "planning",
      String(job.id),
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
    if (job) {
      await job.remove().catch(() => undefined);
    }
    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue plan",
    );
    return handleError(error);
  }
});
