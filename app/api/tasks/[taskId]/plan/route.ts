/**
 * POST /api/tasks/[taskId]/plan
 *
 * TODO (DDD Migration): Atomic claim pattern - same as brainstorm route.
 * Future migration:
 * 1. Create TaskService.startPlanning(taskId, userId) method
 * 2. Move AI plan generation to Application Service
 * 3. Use taskService.updatePlanContent() for saving results
 * 4. Preserve atomic processing slot claiming
 */
import { NextResponse } from "next/server";
import { generatePlan, createAIClient } from "@/lib/ai";
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

    // ATOMIC: Claim the processing slot to prevent concurrent plans
    const claimed = await taskService.claimProcessingSlot(
      taskId,
      "planning",
      "Generating execution plan...",
      "planning",
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

    // Generate plan with repo context
    const result = await generatePlan(
      client,
      task.title,
      task.description,
      task.brainstormResult,
      {
        name: task.repo.name,
        fullName: task.repo.fullName,
        defaultBranch: task.repo.defaultBranch || "main",
      },
    );

    // Save result and clear processing state
    await taskService.clearProcessingSlot(taskId, {
      planContent: JSON.stringify(result, null, 2),
    });

    const updated = await taskService.getTaskFull(taskId);
    return NextResponse.json(updated);
  } catch (error) {
    apiLogger.error(
      {
        taskId,
        provider: config.provider,
        model: config.model,
        error,
      },
      "Plan generation error",
    );

    // Revert status and clear processing state on error
    await taskService.clearProcessingSlot(taskId, { status: "brainstorming" });

    return handleError(error);
  }
});
