import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

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

  const taskService = getTaskService();
  const task = await taskService.getTaskFull(taskId);

  if (!task) {
    return handleError(Errors.notFound("Task"));
  }

  if (task.repo.userId !== session.user.id) {
    return handleError(Errors.forbidden());
  }

  const executionService = getExecutionService();
  const execution = await executionService.getLatestForTask(taskId);

  const events = execution
    ? await executionService.getExecutionEvents(execution.id)
    : [];

  return NextResponse.json({
    task,
    execution,
    events,
  });
}
