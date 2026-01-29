import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, executions, executionEvents } from "@/lib/db";
import { eq, desc, asc } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const { taskId } = await params;

  // Get task with repo relation
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      repo: true,
    },
  });

  if (!task) {
    return handleError(Errors.notFound("Task"));
  }

  // Verify the user owns the repo
  if (task.repo.userId !== session.user.id) {
    return handleError(Errors.forbidden());
  }

  // Get the latest execution for this task
  const execution = await db.query.executions.findFirst({
    where: eq(executions.taskId, taskId),
    orderBy: [desc(executions.createdAt)],
  });

  // Get execution events if there's an execution
  let events: (typeof executionEvents.$inferSelect)[] = [];
  if (execution) {
    events = await db.query.executionEvents.findMany({
      where: eq(executionEvents.executionId, execution.id),
      orderBy: [asc(executionEvents.createdAt)],
    });
  }

  return NextResponse.json({
    task,
    execution,
    events,
  });
}
