import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getBrainstormJobStatus, getPlanJobStatus, getJobStatus } from "@/lib/queue";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
