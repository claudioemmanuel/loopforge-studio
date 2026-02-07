import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { queueExecution } from "@/lib/queue";
import type { TaskStatus } from "@/lib/contexts/task/api";
import {
  withTask,
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { buildExecutionGraph } from "@/lib/shared/graph-builder";
import type { ExecutionData } from "@/lib/shared/graph-types";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
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
    const executionService = getExecutionService();

    // Get latest execution for this task
    const latestExecution = await executionService.getLatestForTask(task.id);

    if (!latestExecution) {
      // No execution yet, return task without graph
      return NextResponse.json(task);
    }

    // Get execution events
    const events = await executionService.getExecutionEvents(
      latestExecution.id,
    );

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
        metadata: e.metadata || undefined,
        createdAt: e.createdAt,
      })),
      commits: latestExecution.commits || undefined,
      startedAt: latestExecution.startedAt || undefined,
      completedAt: latestExecution.completedAt || undefined,
      errorMessage: latestExecution.errorMessage || undefined,
    };

    // Build the execution graph
    const executionGraph = await buildExecutionGraph(executionData);

    // Cache the graph via use case
    const updateStateUseCase = UseCaseFactory.updateProcessingState();
    await updateStateUseCase.execute({
      taskId: task.id,
      executionGraph,
    });

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
      if (body.title || body.description || body.priority !== undefined) {
        const updateFieldsUseCase = UseCaseFactory.updateTaskFields();
        await updateFieldsUseCase.execute({
          taskId,
          fields: {
            title: body.title,
            description: body.description,
            priority: body.priority,
          },
        });
      }

      // Handle autonomousMode separately via configuration use case
      if (body.autonomousMode !== undefined) {
        const configUseCase = UseCaseFactory.updateTaskConfiguration();
        await configUseCase.execute({
          taskId,
          config: { autonomousMode: body.autonomousMode },
        });
      }

      // ATOMIC: Claim the execution slot
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

      // Queue the execution job
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
        ...claimResult.value,
        executionId,
        jobId: job.id,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");

      // Revert execution slot on failure
      const revertUseCase = UseCaseFactory.revertExecutionSlot();
      await revertUseCase.execute({ taskId });

      return handleError(error);
    }
  }

  // Standard update (not moving to executing)
  const fields: Record<string, unknown> = {};
  if (body.title !== undefined) fields.title = body.title;
  if (body.description !== undefined) fields.description = body.description;
  if (body.priority !== undefined) fields.priority = body.priority;

  // Update basic fields if any
  if (Object.keys(fields).length > 0) {
    const updateUseCase = UseCaseFactory.updateTaskFields();
    const result = await updateUseCase.execute({ taskId, fields });

    if (result.isFailure) {
      return handleError(result.error);
    }
  }

  // Handle status change
  if (body.status !== undefined && body.status !== task.status) {
    // When moving backward with resetPhases, clear phase-dependent data
    if (resetPhases) {
      const targetStatus = body.status as TaskStatus;
      const resetFields: Record<string, unknown> = {};

      if (targetStatus === "todo" || targetStatus === "brainstorming") {
        resetFields.planContent = null;
        resetFields.branch = null;
      }

      if (Object.keys(resetFields).length > 0) {
        const updateStateUseCase = UseCaseFactory.updateProcessingState();
        await updateStateUseCase.execute({
          taskId,
          ...resetFields,
        });
      }
    }

    // Update status via use case
    const updateStatusUseCase = UseCaseFactory.updateProcessingState();
    await updateStatusUseCase.execute({
      taskId,
      status: body.status as "brainstorming" | "planning" | "executing",
    });
  }

  // Handle configuration changes
  if (body.autonomousMode !== undefined) {
    const configUseCase = UseCaseFactory.updateTaskConfiguration();
    await configUseCase.execute({
      taskId,
      config: { autonomousMode: body.autonomousMode },
    });
  }

  // Handle plan content and branch updates
  if (body.planContent !== undefined || body.branch !== undefined) {
    const updateStateUseCase = UseCaseFactory.updateProcessingState();
    await updateStateUseCase.execute({
      taskId,
      planContent: body.planContent,
      branch: body.branch,
    });
  }

  // Handle brainstorm result
  if (body.brainstormResult !== undefined) {
    const brainstormUseCase = UseCaseFactory.saveBrainstormResult();
    await brainstormUseCase.execute({
      taskId,
      result: body.brainstormResult,
    });
  }

  // Re-fetch the updated task via use case
  const getTaskUseCase = UseCaseFactory.getTaskWithRepo();
  const taskResult = await getTaskUseCase.execute({ taskId });
  const updatedTask = taskResult.isSuccess ? taskResult.value : task;

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

  // Invalidate caches for this task and related pages
  revalidateTag(`task:${taskId}`);
  revalidateTag("tasks");
  revalidateTag(`repo:${task.repoId}`);

  return NextResponse.json(updatedTask);
});

export const DELETE = withTask(async (request, { task, taskId }) => {
  const useCase = UseCaseFactory.deleteTask();
  const result = await useCase.execute({ taskId });

  if (result.isFailure) {
    return handleError(result.error);
  }

  // Invalidate caches after deletion
  revalidateTag(`task:${taskId}`);
  revalidateTag("tasks");
  revalidateTag(`repo:${task.repoId}`);

  return NextResponse.json({ success: true });
});
