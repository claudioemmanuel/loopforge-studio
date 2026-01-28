/**
 * GET /api/tasks/[taskId]/rollback/check
 * Check if a task's execution can be rolled back
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { canRollback, getCommitsByExecution } from "@/lib/db/execution-commits";

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

  const latestExecution = task.executions?.[0];
  if (!latestExecution) {
    return NextResponse.json({
      canRollback: false,
      reason: "No execution found for task",
      commits: [],
    });
  }

  // Check if rollback is possible
  const rollbackCheck = await canRollback(latestExecution.id);

  // Get commits info
  const commits = await getCommitsByExecution(latestExecution.id);
  const commitInfo = commits.map((c) => ({
    sha: c.commitSha,
    message: c.commitMessage,
    filesChanged: c.filesChanged,
    isReverted: c.isReverted,
    createdAt: c.createdAt,
  }));

  return NextResponse.json({
    ...rollbackCheck,
    executionId: latestExecution.id,
    executionStatus: latestExecution.status,
    isReverted: latestExecution.reverted,
    commits: commitInfo,
    totalCommits: commits.length,
    revertedCommits: commits.filter((c) => c.isReverted).length,
  });
}
