/**
 * GET /api/tasks/[taskId]/diff
 * Get pending changes for a task in review status
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getPendingChangesByTask,
  countPendingChanges,
} from "@/lib/db/pending-changes";
import { getLatestTestRun, getTestRunSummary } from "@/lib/db/test-runs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      repo: true,
      executions: { limit: 1, orderBy: (e, { desc }) => [desc(e.createdAt)] },
    },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Task should be in review status to have pending changes
  if (task.status !== "review" && task.status !== "executing") {
    return NextResponse.json({
      changes: [],
      summary: { total: 0, approved: 0, pending: 0 },
      testRun: null,
      message: `Task status is ${task.status}, no pending changes`,
    });
  }

  // Get pending changes
  const changes = await getPendingChangesByTask(taskId);

  // Get the latest execution to check for test runs
  const latestExecution = task.executions?.[0];
  let testRunData = null;

  if (latestExecution) {
    const testRun = await getLatestTestRun(taskId);
    if (testRun) {
      testRunData = {
        ...testRun,
        ...getTestRunSummary(testRun),
      };
    }

    // Get counts
    const counts = await countPendingChanges(latestExecution.id);

    return NextResponse.json({
      taskId,
      executionId: latestExecution.id,
      changes,
      summary: counts,
      testRun: testRunData,
      canApprove: counts.pending === 0 || counts.total > 0, // Can approve if there are changes
      canReject: counts.total > 0,
    });
  }

  return NextResponse.json({
    taskId,
    changes: [],
    summary: { total: 0, approved: 0, pending: 0 },
    testRun: null,
    canApprove: false,
    canReject: false,
  });
}
