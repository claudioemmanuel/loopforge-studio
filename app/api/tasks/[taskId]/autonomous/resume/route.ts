import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";
import { createDomainEvent } from "@/lib/domain-events/bus";
import { initDomainEventSystem } from "@/lib/application/event-system";
import { publishForJob } from "@/lib/application/event-handlers";
import type { AiProvider } from "@/lib/db/schema";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

// Helper to queue execution for a task with atomic claim
async function queueTaskExecution(
  task: {
    id: string;
    repoId: string;
    planContent: string | null;
    status: string;
    repo: { cloneUrl: string; defaultBranch: string };
  },
  userId: string,
  provider: AiProvider,
  model: string,
) {
  if (!task.planContent) {
    throw new Error("Task must have a plan to execute");
  }

  const branch = `loopforge/${task.id.slice(0, 8)}`;

  // ATOMIC: Claim the execution slot first to prevent race conditions
  // This UPDATE only succeeds if status is NOT 'executing'
  const claimResult = await db
    .update(tasks)
    .set({
      status: "executing",
      branch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tasks.id, task.id),
        ne(tasks.status, "executing"), // Only claim if not already executing
      ),
    )
    .returning({ id: tasks.id });

  // If no rows were updated, another request already started execution
  if (claimResult.length === 0) {
    throw new Error("Task is already executing");
  }

  try {
    // Now create execution record (we have exclusive execution rights)
    const executionId = crypto.randomUUID();
    await db.insert(executions).values({
      id: executionId,
      taskId: task.id,
      status: "queued",
      iteration: 0,
      createdAt: new Date(),
    });

    // Queue the execution job
    // Worker will decrypt API key on demand using userId
    const bus = initDomainEventSystem();
    const job = await publishForJob(
      bus,
      createDomainEvent("TaskExecutionRequested", {
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
      }),
    );

    if (!job || !job.id) {
      throw new Error("Failed to queue execution job");
    }

    return { executionId, jobId: job.id };
  } catch (error) {
    // If queuing failed after claiming, reset the status
    await db
      .update(tasks)
      .set({
        status: task.status as "ready",
        branch: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, task.id),
          eq(tasks.status, "executing"), // Only revert if we set it
        ),
      );
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
    await db
      .update(tasks)
      .set({ autonomousMode: true, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
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
      const { executionId, jobId } = await queueTaskExecution(
        task,
        session.user.id,
        finalProvider,
        finalModel,
      );

      const updatedTask = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });

      return NextResponse.json({
        ...updatedTask,
        executionId,
        jobId,
        autoStarted: true,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");

      // Revert status on error
      await db
        .update(tasks)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      return handleError(error);
    }
  }

  // For other statuses, just enable autonomous mode and return
  await db
    .update(tasks)
    .set({ autonomousMode: true, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const updatedTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  return NextResponse.json({
    ...updatedTask,
    autoStarted: false,
  });
}
