import { NextResponse } from "next/server";
import { db, tasks, executions, executionEvents } from "@/lib/db";
import { eq } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import type { TaskStatus } from "@/lib/db/schema";
import {
  withTask,
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { buildExecutionGraph } from "@/lib/execution/graph-builder";
import type { ExecutionData } from "@/lib/execution/graph-types";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

export const GET = withTask(async (request, { task }) => {
  // Check if graph data is requested via query param
  const { searchParams } = new URL(request.url);
  const includeGraph = searchParams.get("include") === "graph";

  if (!includeGraph) {
    return NextResponse.json(task);
  }

  // If executionGraph is already cached, return it
  if (task.executionGraph) {
    return NextResponse.json({
      ...task,
      executionGraph: task.executionGraph,
    });
  }

  // Build graph from execution data
  try {
    // Get latest execution for this task
    const latestExecution = await db.query.executions.findFirst({
      where: eq(executions.taskId, task.id),
      orderBy: (executions, { desc }) => [desc(executions.createdAt)],
    });

    if (!latestExecution) {
      // No execution yet, return task without graph
      return NextResponse.json(task);
    }

    // Get execution events
    const events = await db.query.executionEvents.findMany({
      where: eq(executionEvents.executionId, latestExecution.id),
      orderBy: (executionEvents, { asc }) => [asc(executionEvents.createdAt)],
    });

    // Build execution data structure
    const executionData: ExecutionData = {
      taskId: task.id,
      executionId: latestExecution.id,
      status: latestExecution.status,
      phase: task.processingPhase || undefined,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        title: e.title || undefined,
        content: e.content,
        metadata: e.metadata as Record<string, unknown> | undefined,
        createdAt: e.createdAt,
      })),
      commits: latestExecution.commits || undefined,
      startedAt: latestExecution.startedAt || undefined,
      completedAt: latestExecution.completedAt || undefined,
      errorMessage: latestExecution.errorMessage || undefined,
    };

    // Build the execution graph
    const executionGraph = await buildExecutionGraph(executionData);

    // Cache the graph in the task record
    const taskService = getTaskService();
    await taskService.updateFields(task.id, { executionGraph });

    return NextResponse.json({
      ...task,
      executionGraph,
    });
  } catch (error) {
    apiLogger.error(
      { taskId: task.id, error },
      "Error building execution graph",
    );
    // Return task without graph on error
    return NextResponse.json(task);
  }
});

export const PATCH = withTask(async (request, { user, task, taskId }) => {
  const body = await request.json();
  const taskService = getTaskService();

  // Handle backward movement with resetPhases option
  const resetPhases = body.resetPhases === true;

  // Check if status is changing to "executing" - auto-queue execution
  const isMovingToExecuting =
    body.status === "executing" && task.status !== "executing";

  if (isMovingToExecuting) {
    // Validate task has a plan
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

      // Apply any metadata changes before claiming
      const metaFields: Record<string, unknown> = {};
      if (body.title !== undefined) metaFields.title = body.title;
      if (body.description !== undefined)
        metaFields.description = body.description;
      if (body.priority !== undefined) metaFields.priority = body.priority;
      if (body.autonomousMode !== undefined)
        metaFields.autonomousMode = body.autonomousMode;
      if (Object.keys(metaFields).length > 0) {
        await taskService.updateFields(taskId, metaFields);
      }

      // ATOMIC: Claim the execution slot – only succeeds if not already executing
      const claimedTask = await taskService.claimExecutionSlot(taskId, branch);

      if (!claimedTask) {
        return handleError(Errors.conflict("Task is already executing"));
      }

      // Create execution record
      const executionService = getExecutionService();
      const executionId = crypto.randomUUID();
      await executionService.createQueued({ id: executionId, taskId });

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
      await taskService.revertExecutionSlot(taskId, task.status);
      return handleError(error);
    }
  }

  // Standard update (not moving to executing)
  const fields: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) fields.title = body.title;
  if (body.description !== undefined) fields.description = body.description;
  if (body.status !== undefined) fields.status = body.status;
  if (body.priority !== undefined) fields.priority = body.priority;
  if (body.branch !== undefined) fields.branch = body.branch;
  if (body.autonomousMode !== undefined)
    fields.autonomousMode = body.autonomousMode;
  if (body.planContent !== undefined) fields.planContent = body.planContent;

  // When moving backward with resetPhases, clear phase-dependent data
  if (resetPhases && body.status) {
    const targetStatus = body.status as TaskStatus;
    if (targetStatus === "todo" || targetStatus === "brainstorming") {
      fields.planContent = null;
      fields.branch = null;
      fields.processingPhase = null;
      fields.processingStatusText = null;
    }
    if (targetStatus === "todo") {
      fields.brainstormSummary = null;
      fields.brainstormConversation = null;
    }
  }

  await taskService.updateFields(taskId, fields);

  if (body.brainstormResult !== undefined) {
    await taskService.saveBrainstormResult(taskId, {
      brainstormResult: body.brainstormResult,
    });
  }

  // Re-fetch the updated task to return fresh data
  const updatedTask = await taskService.getTaskFull(taskId);

  // Record activity events
  const analyticsService = getAnalyticsService();
  const activityPromises: Promise<unknown>[] = [];

  if (body.status !== undefined && body.status !== task.status) {
    activityPromises.push(
      analyticsService.statusChanged({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: body.status,
      }),
    );
  }

  const changes: string[] = [];
  if (body.title !== undefined && body.title !== task.title) {
    changes.push("title");
  }
  if (body.description !== undefined && body.description !== task.description) {
    changes.push("description");
  }
  if (
    body.autonomousMode !== undefined &&
    body.autonomousMode !== task.autonomousMode
  ) {
    changes.push("autonomous mode");
  }

  if (changes.length > 0) {
    activityPromises.push(
      analyticsService.taskUpdated({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: updatedTask?.title || task.title,
        changes,
      }),
    );
  }

  if (activityPromises.length > 0) {
    await Promise.all(activityPromises);
  }

  return NextResponse.json(updatedTask);
});

export const DELETE = withTask(async (request, { taskId }) => {
  await db.delete(tasks).where(eq(tasks.id, taskId));

  return NextResponse.json({ success: true });
});
