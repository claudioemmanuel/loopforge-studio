import { NextResponse } from "next/server";
import { db, tasks, taskDependencies } from "@/lib/db";
import { eq, and, notInArray } from "drizzle-orm";
import { withTask } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";

// GET - Get task dependencies
export const GET = withTask(async (request, { task, taskId }) => {
  // Use GetTaskDependencyGraphUseCase for the graph structure
  const graphUseCase = UseCaseFactory.getTaskDependencyGraph();
  const graphResult = await graphUseCase.execute({ taskId });

  if (graphResult.isFailure) {
    return handleError(graphResult.error);
  }

  const graph = graphResult.value;

  // Get available tasks (same repo, not self, not already a dependency)
  const existingBlockerIds = graph.dependencies.map((d) => d.id);
  const excludeIds = [taskId, ...existingBlockerIds];

  const availableTasks = await db.query.tasks.findMany({
    where: and(eq(tasks.repoId, task.repoId), notInArray(tasks.id, excludeIds)),
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  // Format response to match expected structure
  return NextResponse.json({
    blockedBy: graph.dependencies.map((dep) => ({
      task: dep,
      dependency: {
        taskId,
        blockedById: dep.id,
        createdAt: new Date().toISOString(),
      },
    })),
    blocks: graph.dependents.map((dependent) => ({
      task: dependent,
      dependency: {
        taskId: dependent.id,
        blockedById: taskId,
        createdAt: new Date().toISOString(),
      },
    })),
    availableTasks,
    autoExecuteWhenUnblocked: task.autoExecuteWhenUnblocked ?? false,
    dependencyPriority: task.dependencyPriority ?? 0,
  });
});

// POST - Add a dependency
export const POST = withTask(async (request, { task, taskId }) => {
  const body = await request.json();
  const { blockedById } = body;

  if (!blockedById) {
    return handleError(Errors.invalidRequest("blockedById is required"));
  }

  // Verify blocker task exists and is in same repo
  const blockerTask = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, blockedById), eq(tasks.repoId, task.repoId)),
  });

  if (!blockerTask) {
    return handleError(Errors.notFound("Blocker task"));
  }

  // Prevent self-dependency
  if (taskId === blockedById) {
    return handleError(Errors.invalidRequest("Cannot depend on self"));
  }

  // Check for circular dependency
  const checkCircular = async (
    checkId: string,
    visited: Set<string> = new Set(),
  ): Promise<boolean> => {
    if (visited.has(checkId)) return false;
    if (checkId === taskId) return true; // Circular detected!

    visited.add(checkId);

    const deps = await db.query.taskDependencies.findMany({
      where: eq(taskDependencies.taskId, checkId),
    });

    for (const dep of deps) {
      if (await checkCircular(dep.blockedById, visited)) {
        return true;
      }
    }

    return false;
  };

  if (await checkCircular(blockedById)) {
    return handleError(
      Errors.invalidRequest("Would create circular dependency"),
    );
  }

  // Check if dependency already exists
  const existing = await db.query.taskDependencies.findFirst({
    where: and(
      eq(taskDependencies.taskId, taskId),
      eq(taskDependencies.blockedById, blockedById),
    ),
  });

  if (existing) {
    return handleError(Errors.conflict("Dependency already exists"));
  }

  // Create the dependency via use case
  const useCase = UseCaseFactory.addTaskDependency();
  const result = await useCase.execute({
    taskId,
    dependsOnId: blockedById,
  });

  if (result.isFailure) {
    return handleError(result.error);
  }

  return NextResponse.json({
    success: true,
    blockedByIds: result.value.blockedByIds,
  });
});

// DELETE - Remove a dependency
export const DELETE = withTask(async (request, { task, taskId }) => {
  const body = await request.json();
  const { blockedById } = body;

  if (!blockedById) {
    return handleError(Errors.invalidRequest("blockedById is required"));
  }

  // Remove the dependency via use case
  const useCase = UseCaseFactory.removeTaskDependency();
  const result = await useCase.execute({
    taskId,
    dependsOnId: blockedById,
  });

  if (result.isFailure) {
    return handleError(result.error);
  }

  return NextResponse.json({ success: true });
});

// PATCH - Update dependency settings
export const PATCH = withTask(async (request, { task, taskId }) => {
  const body = await request.json();
  const { autoExecuteWhenUnblocked, dependencyPriority } = body;

  const useCase = UseCaseFactory.updateDependencySettings();
  const result = await useCase.execute({
    taskId,
    settings: {
      strictDependencyOrder: autoExecuteWhenUnblocked,
      allowParallelExecution: dependencyPriority === 0,
    },
  });

  if (result.isFailure) {
    return handleError(result.error);
  }

  return NextResponse.json({
    success: true,
    ...result.value.settings,
  });
});
