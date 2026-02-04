import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

/**
 * POST /api/tasks/[taskId]/autonomous/resume
 *
 * Enables autonomous mode and resumes from current stage.
 * - If status === "ready": immediately queue execution
 * - If status === "executing" or "done": return error (can't enable mid-execution)
 * - Otherwise: just set the flag
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return handleError(Errors.notFound("Task"));
  }

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

  const taskService = getTaskService();

  // If task is "ready", enable autonomous mode AND queue execution
  if (task.status === "ready") {
    await taskService.enableAutonomousMode(taskId);

    if (!task.planContent) {
      return handleError(
        Errors.invalidRequest("Task must have a plan to execute"),
      );
    }

    // Get user details for API key
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return handleError(Errors.notFound("User"));
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

      // ATOMIC: Claim the execution slot
      const claimedTask = await taskService.claimExecutionSlot(taskId, branch);
      if (!claimedTask) {
        throw new Error("Task is already executing");
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
        userId: session.user.id,
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
        autoStarted: true,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");
      await taskService.revertExecutionSlot(taskId, "ready");
      return handleError(error);
    }
  }

  // For other statuses, just enable autonomous mode and return
  const updatedTask = await taskService.enableAutonomousMode(taskId);

  return NextResponse.json({
    ...updatedTask,
    autoStarted: false,
  });
}
