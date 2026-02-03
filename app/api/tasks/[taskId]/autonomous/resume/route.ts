import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import type { AiProvider, Task } from "@/lib/db/schema";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import {
  ExecutionAggregate,
  ExecutionRepository,
  TaskAggregate,
  TaskRepository,
} from "@/lib/domain";

// Helper to queue execution for a task with atomic claim
async function queueTaskExecution(
  task: Task & { repo: { cloneUrl: string; defaultBranch: string } },
  userId: string,
  provider: AiProvider,
  model: string,
) {
  if (!task.planContent) {
    throw new Error("Task must have a plan to execute");
  }

  const branch = `loopforge/${task.id.slice(0, 8)}`;
  const taskAggregate = TaskAggregate.fromPersistence(task);
  taskAggregate.claimExecution(branch);
  const taskRepository = new TaskRepository();

  // ATOMIC: Claim the execution slot first to prevent race conditions
  // This UPDATE only succeeds if status is NOT 'executing'
  const claimedTask = await taskRepository.saveWithStatusGuard(taskAggregate, {
    ne: "executing",
  });

  if (!claimedTask) {
    throw new Error("Task is already executing");
  }

  try {
    // Now create execution record (we have exclusive execution rights)
    const executionId = crypto.randomUUID();
    const executionAggregate = ExecutionAggregate.createQueued({
      id: executionId,
      taskId: task.id,
    });
    const executionRepository = new ExecutionRepository();
    await executionRepository.create(executionAggregate);

    // Queue the execution job
    // Worker will decrypt API key on demand using userId
    const job = await queueExecution({
      executionId,
      taskId: task.id,
      repoId: task.repoId,
      userId,
      aiProvider: provider,
      preferredModel: model,
      planContent: task.planContent,
      branch,
      defaultBranch: task.repo.defaultBranch || "main",
      cloneUrl: task.repo.cloneUrl,
    });

    return { executionId, jobId: job.id, claimedTask };
  } catch (error) {
    // If queuing failed after claiming, reset the status
    const revertAggregate = TaskAggregate.fromPersistence(task);
    revertAggregate.revertExecution(task.status as "ready");
    await taskRepository.saveWithStatusGuard(revertAggregate, {
      eq: "executing",
    });
    throw error;
  }
}

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

  // If task is "ready", enable autonomous mode AND queue execution atomically
  if (task.status === "ready") {
    // First enable autonomous mode (will be committed with execution claim)
    const taskRepository = new TaskRepository();
    const taskAggregate = TaskAggregate.fromPersistence(task);
    taskAggregate.updateDetails({ autonomousMode: true });
    const updatedTask = await taskRepository.save(taskAggregate);
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
      const { executionId, jobId, claimedTask } = await queueTaskExecution(
        updatedTask,
        session.user.id,
        finalProvider,
        finalModel,
      );

      return NextResponse.json({
        ...claimedTask,
        executionId,
        jobId,
        autoStarted: true,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");

      // Revert status on error
      const taskRepository = new TaskRepository();
      const revertAggregate = TaskAggregate.fromPersistence(task);
      revertAggregate.revertExecution("ready");
      await taskRepository.saveWithStatusGuard(revertAggregate, {
        eq: "executing",
      });

      return handleError(error);
    }
  }

  // For other statuses, just enable autonomous mode and return
  const taskRepository = new TaskRepository();
  const taskAggregate = TaskAggregate.fromPersistence(task);
  taskAggregate.updateDetails({ autonomousMode: true });
  const updatedTask = await taskRepository.save(taskAggregate);

  return NextResponse.json({
    ...updatedTask,
    autoStarted: false,
  });
}
