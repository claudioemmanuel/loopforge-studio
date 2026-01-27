import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, executions, executionEvents, repos } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/tasks/[taskId]/execution
 * Returns task details, latest execution, and all events for the execution page
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      repo: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify user owns the repo
  if (task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get latest execution for this task
  const execution = await db.query.executions.findFirst({
    where: eq(executions.taskId, taskId),
    orderBy: [desc(executions.createdAt)],
  });

  // Get execution events if we have an execution
  let events: Array<typeof executionEvents.$inferSelect> = [];
  if (execution) {
    events = await db.query.executionEvents.findMany({
      where: eq(executionEvents.executionId, execution.id),
      orderBy: [executionEvents.createdAt],
    });
  }

  return NextResponse.json({
    task: {
      ...task,
      repo: {
        ...task.repo,
        // Include clone/index status from repo
        isCloned: task.repo.isCloned,
        indexingStatus: task.repo.indexingStatus,
      },
    },
    execution,
    events,
  });
}
