import { NextResponse } from "next/server";
import { queueExecution } from "@/lib/queue";
import {
  withTask,
  getPreferredModel,
  getProviderApiKey,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { getExecutionService } from "@/lib/contexts/execution/api";

/**
 * POST /api/tasks/[taskId]/autonomous/resume
 *
 * Enables autonomous mode and resumes from current stage.
 * - If status === "ready": immediately queue execution
 * - If status === "executing" or "done": return error (can't enable mid-execution)
 * - Otherwise: just set the flag
 */
export const POST = withTask(async (request, { user, task, taskId }) => {
  // Don't allow enabling autonomous mode during execution or after completion
  if (task.status === "executing") {
    return handleError(
      Errors.invalidRequest("Cannot enable autonomous mode while executing"),
    );
  }

  if (task.status === "done") {
    return handleError(
      Errors.invalidRequest(
        "Cannot enable autonomous mode for completed tasks",
      ),
    );
  }

  // If task is "ready", enable autonomous mode AND queue execution
  if (task.status === "ready") {
    // Enable autonomous mode via use case
    const enableAutoUseCase = UseCaseFactory.enableAutonomousMode();
    const enableResult = await enableAutoUseCase.execute({
      taskId,
      enabled: true,
    });

    if (enableResult.isFailure) {
      return handleError(enableResult.error);
    }

    if (!task.planContent) {
      return handleError(
        Errors.invalidRequest("Task must have a plan to execute"),
      );
    }

    // BYOK only: User needs at least one API key configured
    const configuredProvider = findConfiguredProvider(user);
    if (!configuredProvider) {
      return handleError(Errors.noProviderConfigured());
    }

    const encryptedKey = getProviderApiKey(user, configuredProvider);
    if (!encryptedKey) {
      return handleError(Errors.authError(configuredProvider));
    }

    const finalProvider = configuredProvider;
    const finalModel = getPreferredModel(user, configuredProvider);

    try {
      const branch = `loopforge/${task.id.slice(0, 8)}`;

      // ATOMIC: Claim the execution slot via use case
      const claimUseCase = UseCaseFactory.claimExecutionSlot();
      const claimResult = await claimUseCase.execute({
        taskId,
        workerId: branch,
      });

      if (claimResult.isFailure) {
        return handleError(Errors.conflict("Task is already executing"));
      }

      // Create execution record
      const executionService = getExecutionService();
      const executionId = crypto.randomUUID();
      await executionService.createQueued({ id: executionId, taskId });

      // Queue the execution job – worker decrypts API key on demand
      const job = await queueExecution({
        executionId,
        taskId,
        repoId: task.repoId,
        userId: user.id,
        aiProvider: finalProvider,
        preferredModel: finalModel,
        planContent: task.planContent,
        branch,
        defaultBranch: task.repo.defaultBranch || "main",
        cloneUrl: task.repo.cloneUrl,
      });

      return NextResponse.json({
        ...claimResult.value,
        executionId,
        jobId: job.id,
        autoStarted: true,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");

      // Revert execution slot on error via use case
      const revertUseCase = UseCaseFactory.revertExecutionSlot();
      await revertUseCase.execute({ taskId });

      return handleError(error);
    }
  }

  // For other statuses, just enable autonomous mode and return
  const enableAutoUseCase = UseCaseFactory.enableAutonomousMode();
  const enableResult = await enableAutoUseCase.execute({
    taskId,
    enabled: true,
  });

  if (enableResult.isFailure) {
    return handleError(enableResult.error);
  }

  return NextResponse.json({
    ...enableResult.value,
    autoStarted: false,
  });
});
