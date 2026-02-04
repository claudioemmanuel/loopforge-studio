import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getBrainstormJobStatus,
  getPlanJobStatus,
  getJobStatus,
} from "@/lib/queue";
import { handleError, Errors } from "@/lib/errors";
import { getTaskService } from "@/lib/contexts/task/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const taskService = getTaskService();
  const task = await taskService.getTaskFull(taskId);

  if (!task || task.repo.userId !== session.user.id) {
    return handleError(Errors.notFound("Task"));
  }

  // If not processing, return null state
  if (!task.processingPhase) {
    return NextResponse.json({
      processing: false,
      processingPhase: null,
      jobId: null,
      statusText: null,
      startedAt: null,
    });
  }

  // Get job status based on processing phase
  let jobStatus = null;
  if (task.processingJobId) {
    switch (task.processingPhase) {
      case "brainstorming":
        jobStatus = await getBrainstormJobStatus(task.processingJobId);
        break;
      case "planning":
        jobStatus = await getPlanJobStatus(task.processingJobId);
        break;
      case "executing":
        jobStatus = await getJobStatus(task.processingJobId);
        break;
    }
  }

  return NextResponse.json({
    processing: true,
    processingPhase: task.processingPhase,
    jobId: task.processingJobId,
    statusText: task.processingStatusText,
    startedAt: task.processingStartedAt?.toISOString(),
    jobState: jobStatus?.state,
    jobProgress: jobStatus?.progress,
  });
}
