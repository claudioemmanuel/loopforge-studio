/**
 * POST /api/tasks/[taskId]/plan
 * Generate execution plan for a task
 */
import { NextResponse } from "next/server";
import { generatePlan, createAIClient } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { apiLogger } from "@/lib/logger";

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

    // ATOMIC: Claim the planning slot
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

    // Save plan
    const savePlanUseCase = UseCaseFactory.savePlan();
    const saveResult = await savePlanUseCase.execute({
      taskId,
      plan: JSON.stringify(result, null, 2),
    });

    if (saveResult.isFailure) {
      return handleError(saveResult.error);
    }

    // Transition to ready
    const finalizeUseCase = UseCaseFactory.finalizePlanning();
    const finalizeResult = await finalizeUseCase.execute({ taskId });

    if (finalizeResult.isFailure) {
      return handleError(finalizeResult.error);
    }

    // Fetch updated task
    const getTaskUseCase = UseCaseFactory.getTaskWithRepo();
    const taskResult = await getTaskUseCase.execute({ taskId });

    return NextResponse.json(taskResult.isSuccess ? taskResult.value : task);
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

    // Revert to brainstorming on error
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({ taskId, revertToStatus: "brainstorming" });

    return handleError(error);
  }
});
