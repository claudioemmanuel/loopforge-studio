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
import {
  createStatusChangeEvent,
  createTaskUpdatedEvent,
} from "@/lib/activity";
import { buildExecutionGraph } from "@/lib/execution/graph-builder";
import type { ExecutionData } from "@/lib/execution/graph-types";
import {
  ExecutionAggregate,
  ExecutionRepository,
  TaskAggregate,
  TaskRepository,
} from "@/lib/domain";

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
    const taskAggregate = TaskAggregate.fromPersistence(task);
    taskAggregate.updateExecutionGraph(executionGraph);
    const taskRepository = new TaskRepository();
    await taskRepository.save(taskAggregate);

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
  const taskAggregate = TaskAggregate.fromPersistence(task);
  const taskRepository = new TaskRepository();

  // Handle backward movement with resetPhases option
  // When moving backward and resetPhases is true, clear data based on target status
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
      taskAggregate.updateDetails({
        title: body.title,
        description: body.description ?? undefined,
        priority: body.priority,
        autonomousMode: body.autonomousMode,
        branch,
        status: "executing",
        resetPhases,
        statusTriggeredBy: "user",
        statusTriggeredByUserId: user.id,
      });

      // ATOMIC: Claim the execution slot first to prevent race conditions
      // This UPDATE only succeeds if status is NOT 'executing' (not already running)
      const claimedTask = await taskRepository.saveWithStatusGuard(
        taskAggregate,
        { ne: "executing" },
      );

      if (!claimedTask) {
        return handleError(Errors.conflict("Task is already executing"));
      }

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

      // Revert status on error (only if we set it to executing)
      const revertAggregate = TaskAggregate.fromPersistence(task);
      revertAggregate.revertExecution(task.status);
      await taskRepository.saveWithStatusGuard(revertAggregate, {
        eq: "executing",
      });

      return handleError(error);
    }
  }

  taskAggregate.updateDetails({
    title: body.title,
    description: body.description ?? undefined,
    status: (body.status ?? undefined) as TaskStatus | undefined,
    priority: body.priority,
    branch: body.branch,
    autonomousMode: body.autonomousMode,
    planContent: body.planContent,
    resetPhases,
    statusTriggeredBy: "user",
    statusTriggeredByUserId: user.id,
  });
  if (body.brainstormResult !== undefined) {
    taskAggregate.recordBrainstorm({
      brainstormResult: body.brainstormResult,
    });
  }

  // Standard update (not moving to executing)
  const updatedTask = await taskRepository.save(taskAggregate);

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
