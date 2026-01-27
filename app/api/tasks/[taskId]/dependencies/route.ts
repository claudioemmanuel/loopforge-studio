import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, repos, taskDependencies } from "@/lib/db";
import { eq, and, ne, notInArray } from "drizzle-orm";

// GET - Get task dependencies
export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task and verify ownership
  const task = await db.query.tasks.findFirst({
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

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Get tasks that block this one (dependencies)
  const blockedBy = task.dependencies.map((dep) => ({
    dependency: {
      id: dep.id,
      taskId: dep.taskId,
      blockedById: dep.blockedById,
      createdAt: dep.createdAt,
    },
    task: dep.blockedBy,
  }));

  // Get tasks that this task blocks (dependents)
  const blocks = task.dependents.map((dep) => ({
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
}

// POST - Add a dependency
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { blockedById } = body;

  if (!blockedById) {
    return NextResponse.json(
      { error: "blockedById is required" },
      { status: 400 },
    );
  }

  // Get task and verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify blocker task exists and is in same repo
  const blockerTask = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, blockedById), eq(tasks.repoId, task.repoId)),
  });

  if (!blockerTask) {
    return NextResponse.json(
      { error: "Blocker task not found" },
      { status: 404 },
    );
  }

  // Prevent self-dependency
  if (taskId === blockedById) {
    return NextResponse.json(
      { error: "Cannot depend on self" },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: "Would create circular dependency" },
      { status: 400 },
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
    return NextResponse.json(
      { error: "Dependency already exists" },
      { status: 409 },
    );
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
  const currentBlockedBy = (task.blockedByIds as string[]) || [];
  await db
    .update(tasks)
    .set({
      blockedByIds: [...currentBlockedBy, blockedById],
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  return NextResponse.json(newDependency);
}

// DELETE - Remove a dependency
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { blockedById } = body;

  if (!blockedById) {
    return NextResponse.json(
      { error: "blockedById is required" },
      { status: 400 },
    );
  }

  // Get task and verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
  const currentBlockedBy = (task.blockedByIds as string[]) || [];
  await db
    .update(tasks)
    .set({
      blockedByIds: currentBlockedBy.filter((id) => id !== blockedById),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  return NextResponse.json({ success: true });
}

// PATCH - Update dependency settings
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { autoExecuteWhenUnblocked, dependencyPriority } = body;

  // Get task and verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (typeof autoExecuteWhenUnblocked === "boolean") {
    updates.autoExecuteWhenUnblocked = autoExecuteWhenUnblocked;
  }

  if (typeof dependencyPriority === "number") {
    updates.dependencyPriority = dependencyPriority;
  }

  // Update the task
  await db.update(tasks).set(updates).where(eq(tasks.id, taskId));

  return NextResponse.json({ success: true, ...updates });
}
