/**
 * POST /api/tasks/[taskId]/brainstorm/start
 *
 * TODO (DDD Migration): Similar to main brainstorm route - needs atomic operation preservation.
 * Future work:
 * 1. Create TaskService.startBrainstormJob(taskId, userId) method
 * 2. Move queue orchestration to Application Service
 * 3. Domain events should auto-create activity events (remove manual creation)
 */
import { NextResponse } from "next/server";
import { queueBrainstorm } from "@/lib/queue";
import {
  publishProcessingEvent,
  createProcessingEvent,
} from "@/lib/workers/events";
import { withTask, getProviderApiKey, findConfiguredProvider } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getTaskService } from "@/lib/contexts/task/api";

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

  let job: Awaited<ReturnType<typeof queueBrainstorm>> | undefined;

  try {
    const startedAt = new Date();
    const taskService = getTaskService();

    // Now queue the job (we have exclusive processing rights)
    // Worker will decrypt API key on demand using userId
    job = await queueBrainstorm({
      taskId,
      userId: user.id,
      repoId: task.repoId,
      continueToPlanning: task.autonomousMode,
    });

    await taskService.startBrainstorm({
      taskId,
      jobId: String(job.id),
    });

    // Publish processing_start event
    const processingEvent = createProcessingEvent(
      "processing_start",
      taskId,
      task.title,
      task.repo.name,
      "brainstorming",
      String(job.id),
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
    if (job) {
      await job.remove().catch(() => undefined);
    }
    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue brainstorm",
    );
    return handleError(error);
  }
});
