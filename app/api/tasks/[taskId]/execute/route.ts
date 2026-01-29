import { NextResponse } from "next/server";
import { db, tasks, executions } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import {
  withTask,
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

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

    // ATOMIC: Claim the execution slot first to prevent race conditions
    // This UPDATE only succeeds if status = 'ready' (not already executing)
    const claimResult = await db
      .update(tasks)
      .set({
        status: "executing",
        branch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.status, "ready"), // Only claim if still ready
        ),
      )
      .returning({ id: tasks.id });

    // If no rows were updated, another request already started execution
    if (claimResult.length === 0) {
      return NextResponse.json(
        { error: "Task is already executing or not in ready status" },
        { status: 409 },
      );
    }

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

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json({
      ...updatedTask,
      executionId,
      jobId: job.id,
    });
  } catch (error) {
    apiLogger.error({ taskId, error }, "Execution error");

    // Revert status on error (only if we claimed it)
    await db
      .update(tasks)
      .set({ status: "ready", branch: null, updatedAt: new Date() })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.status, "executing"), // Only revert if we set it
        ),
      );

    return handleError(error);
  }
});
