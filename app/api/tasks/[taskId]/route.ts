import { NextResponse } from "next/server";
import { db, tasks, executions, executionEvents } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";
import { createDomainEvent } from "@/lib/domain-events/bus";
import { initDomainEventSystem } from "@/lib/application/event-system";
import { publishForJob } from "@/lib/application/event-handlers";
import type { TaskStatus, StatusHistoryEntry } from "@/lib/db/schema";
import {
  withTask,
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import {
  createStatusChangeEvent,
  createTaskUpdatedEvent,
  createExecutionStartEvent,
} from "@/lib/activity";
import { buildExecutionGraph } from "@/lib/execution/graph-builder";
import type { ExecutionData } from "@/lib/execution/graph-types";

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
    await db
      .update(tasks)
      .set({ executionGraph, updatedAt: new Date() })
      .where(eq(tasks.id, task.id));

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
  const updates: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: number;
    brainstormResult: string | null;
    planContent: string | null;
    branch: string;
    autonomousMode: boolean;
    statusHistory: StatusHistoryEntry[];
  }> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.brainstormResult !== undefined)
    updates.brainstormResult = body.brainstormResult;
  if (body.planContent !== undefined) updates.planContent = body.planContent;
  if (body.branch !== undefined) updates.branch = body.branch;
  if (body.autonomousMode !== undefined)
    updates.autonomousMode = body.autonomousMode;

  // Record status change in history
  if (body.status !== undefined && body.status !== task.status) {
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: body.status as TaskStatus,
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: user.id,
    };
    updates.statusHistory = [...(task.statusHistory || []), historyEntry];
  }

  // Handle backward movement with resetPhases option
  // When moving backward and resetPhases is true, clear data based on target status
  if (body.resetPhases === true && body.status !== undefined) {
    const targetStatus = body.status as TaskStatus;

    // Reset logic based on target status:
    // - Moving to "todo": clear brainstormResult and planContent
    // - Moving to "brainstorming": clear planContent
    if (targetStatus === "todo") {
      updates.brainstormResult = null;
      updates.planContent = null;
    } else if (targetStatus === "brainstorming") {
      updates.planContent = null;
    }
  }

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
      updates.branch = branch;

      // ATOMIC: Claim the execution slot first to prevent race conditions
      // This UPDATE only succeeds if status is NOT 'executing' (not already running)
      const claimResult = await db
        .update(tasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.id, taskId),
            ne(tasks.status, "executing"), // Only claim if not already executing
          ),
        )
        .returning({ id: tasks.id });

      // If no rows were updated, another request already started execution
      if (claimResult.length === 0) {
        return handleError(Errors.conflict("Task is already executing"));
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
      const bus = initDomainEventSystem();
      const job = await publishForJob(
        bus,
        createDomainEvent("TaskExecutionRequested", {
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
        }),
      );

      if (!job || !job.id) {
        throw new Error("Failed to queue execution job");
      }

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

      // Revert status on error (only if we set it to executing)
      await db
        .update(tasks)
        .set({ status: task.status, branch: null, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.status, "executing"), // Only revert if we set it
          ),
        );

      return handleError(error);
    }
  }

  // Standard update (not moving to executing)
  await db
    .update(tasks)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const updatedTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  // Create activity events for the update
  const activityPromises: Promise<unknown>[] = [];

  // Status change event
  if (body.status !== undefined && body.status !== task.status) {
    activityPromises.push(
      createStatusChangeEvent({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: body.status,
      }),
    );
  }

  // Task updated event (for other changes)
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
      createTaskUpdatedEvent({
        taskId,
        repoId: task.repoId,
        userId: user.id,
        taskTitle: updatedTask?.title || task.title,
        changes,
      }),
    );
  }

  // Create all activity events in parallel
  if (activityPromises.length > 0) {
    await Promise.all(activityPromises);
  }

  return NextResponse.json(updatedTask);
});

export const DELETE = withTask(async (request, { taskId }) => {
  await db.delete(tasks).where(eq(tasks.id, taskId));

  return NextResponse.json({ success: true });
});
