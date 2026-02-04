/**
 * POST /api/tasks/[taskId]/brainstorm
 *
 * TODO (DDD Migration): This handler uses atomic DB operations for race condition prevention.
 * Proper migration requires:
 * 1. Create TaskService.startBrainstorm(taskId, userId) method
 * 2. Implement atomic processing slot claiming in domain layer
 * 3. Move AI brainstorm orchestration to Application Service
 * 4. Use taskService.updateBrainstormResult() for saving results
 * 5. Ensure atomic state verification remains intact
 *
 * Current critical operations:
 * - Atomic claim: Prevents concurrent brainstorm requests (lines 24-38)
 * - State verification: Discards result if task state changed (lines 56-70)
 * - Error reversion: Reverts to "todo" on AI errors (lines 96-104)
 */
import { NextResponse } from "next/server";
import { brainstormTask, createAIClient } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { apiLogger } from "@/lib/logger";

export const POST = withTask(async (request, { user, task, taskId }) => {
  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  const taskService = getTaskService();

  try {
    const client = await createAIClient(
      config.provider,
      config.apiKey,
      config.model,
    );

    // ATOMIC: Claim the processing slot to prevent concurrent brainstorms
    const claimed = await taskService.claimProcessingSlot(
      taskId,
      "brainstorming",
      "Analyzing task requirements...",
      "brainstorming",
    );

    if (!claimed) {
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

    // Save result and clear processing state (only if still brainstorming)
    await taskService.updateFields(taskId, {
      brainstormResult: JSON.stringify(result, null, 2),
      processingPhase: null,
      processingStatusText: null,
    });

    // Verify the update landed (task may have been moved by user during AI call)
    const updated = await taskService.getTaskFull(taskId);
    if (!updated || updated.status !== "brainstorming") {
      apiLogger.warn(
        { taskId },
        "Task state changed during processing, discarding result",
      );
      return NextResponse.json(
        { error: "Task state changed during processing" },
        { status: 409 },
      );
    }

    return NextResponse.json(updated);
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
    await taskService.clearProcessingSlot(taskId, { status: "todo" });

    return handleError(error);
  }
});
