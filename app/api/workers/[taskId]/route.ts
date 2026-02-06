import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
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

  // Get task with repo via use case
  const getTaskUseCase = UseCaseFactory.getTaskWithRepo();
  const taskResult = await getTaskUseCase.execute({ taskId });

  if (taskResult.isFailure) {
    return handleError(taskResult.error);
  }

  const task = taskResult.value;

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
