import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import {
  withTask,
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

export const POST = withTask(async (request, { user, task, taskId }) => {
  if (task.status !== "ready") {
    return NextResponse.json(
      { error: "Task must be in ready status to execute" },
      { status: 400 },
    );
  }

  if (!task.planContent) {
    return NextResponse.json(
      { error: "Task must have a plan to execute" },
      { status: 400 },
    );
  }

  // Check for blocking dependencies
  const blockedByIds = task.blockedByIds || [];
  if (blockedByIds.length > 0) {
    const blockerTasks = await db.query.tasks.findMany({
      where: inArray(tasks.id, blockedByIds),
      columns: { id: true, title: true, status: true },
    });

    const incompleteBlockers = blockerTasks.filter(
      (blocker) => blocker.status !== "done",
    );

    if (incompleteBlockers.length > 0) {
      return NextResponse.json(
        {
          error: "Task is blocked by incomplete dependencies",
          blockedBy: incompleteBlockers.map((blocker) => ({
            id: blocker.id,
            title: blocker.title,
            status: blocker.status,
          })),
        },
        { status: 400 },
      );
    }
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
    const taskService = getTaskService();
    const executionService = getExecutionService();

    // ATOMIC: Claim the execution slot – only succeeds if status is still 'ready'
    const claimedTask = await taskService.claimExecutionSlot(taskId, branch);

    if (!claimedTask) {
      return NextResponse.json(
        { error: "Task is already executing or not in ready status" },
        { status: 409 },
      );
    }

    // Create execution record (we hold exclusive execution rights)
    const executionId = crypto.randomUUID();
    await executionService.createQueued({ id: executionId, taskId: task.id });

    // Queue the execution job – worker decrypts API key on demand
    const job = await queueExecution({
      executionId,
      taskId: task.id,
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
      ...claimedTask,
      executionId,
      jobId: job.id,
    });
  } catch (error) {
    apiLogger.error({ taskId, error }, "Execution error");

    // Revert status on error (only if we claimed it)
    const taskService = getTaskService();
    await taskService.revertExecutionSlot(taskId, "ready");

    return handleError(error);
  }
});
