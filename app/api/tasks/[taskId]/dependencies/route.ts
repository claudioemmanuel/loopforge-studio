import { NextResponse } from "next/server";
import { db, tasks, taskDependencies } from "@/lib/db";
import { eq, and, notInArray } from "drizzle-orm";
import { withTask } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { TaskAggregate, TaskRepository } from "@/lib/domain";

// GET - Get task dependencies
export const GET = withTask(async (request, { task, taskId }) => {
  // Re-fetch task with dependency relations (withTask only provides { repo })
  const taskWithDeps = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      repo: true,
      dependencies: {
        with: {
          blockedBy: true,
        },
      },
      dependents: {
        with: {
          task: true,
        },
      },
    },
  });

  if (!taskWithDeps) {
    return handleError(Errors.notFound("Task"));
  }

  // Get tasks that block this one (dependencies)
  const blockedBy = taskWithDeps.dependencies.map((dep) => ({
    dependency: {
      id: dep.id,
      taskId: dep.taskId,
      blockedById: dep.blockedById,
      createdAt: dep.createdAt,
    },
    task: dep.blockedBy,
  }));

  // Get tasks that this task blocks (dependents)
  const blocks = taskWithDeps.dependents.map((dep) => ({
    dependency: {
      id: dep.id,
      taskId: dep.taskId,
      blockedById: dep.blockedById,
      createdAt: dep.createdAt,
    },
    task: dep.task,
  }));

  // Get available tasks (same repo, not self, not already a dependency)
  const existingBlockerIds = blockedBy.map((b) => b.task.id);
  const excludeIds = [taskId, ...existingBlockerIds];

  const availableTasks = await db.query.tasks.findMany({
    where: and(eq(tasks.repoId, task.repoId), notInArray(tasks.id, excludeIds)),
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  return NextResponse.json({
    blockedBy,
    blocks,
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

  // Create the dependency
  const dependencyId = crypto.randomUUID();
  const newDependency = {
    id: dependencyId,
    taskId,
    blockedById,
    createdAt: new Date(),
  };

  await db.insert(taskDependencies).values(newDependency);

  // Update the blockedByIds array on the task
  const taskAggregate = TaskAggregate.fromPersistence(task);
  taskAggregate.addDependency(blockedById);
  const taskRepository = new TaskRepository();
  await taskRepository.save(taskAggregate);

  return NextResponse.json(newDependency);
});

// DELETE - Remove a dependency
export const DELETE = withTask(async (request, { task, taskId }) => {
  const body = await request.json();
  const { blockedById } = body;

  if (!blockedById) {
    return handleError(Errors.invalidRequest("blockedById is required"));
  }

  // Delete the dependency
  await db
    .delete(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.blockedById, blockedById),
      ),
    );

  // Update the blockedByIds array on the task
  const taskAggregate = TaskAggregate.fromPersistence(task);
  taskAggregate.removeDependency(blockedById);
  const taskRepository = new TaskRepository();
  await taskRepository.save(taskAggregate);

  return NextResponse.json({ success: true });
});

// PATCH - Update dependency settings
export const PATCH = withTask(async (request, { task, taskId }) => {
  const body = await request.json();
  const { autoExecuteWhenUnblocked, dependencyPriority } = body;

  const taskAggregate = TaskAggregate.fromPersistence(task);
  taskAggregate.updateDependencySettings({
    autoExecuteWhenUnblocked,
    dependencyPriority,
  });
  const taskRepository = new TaskRepository();
  const updatedTask = await taskRepository.save(taskAggregate);

  return NextResponse.json({
    success: true,
    autoExecuteWhenUnblocked: updatedTask.autoExecuteWhenUnblocked,
    dependencyPriority: updatedTask.dependencyPriority,
  });
});
