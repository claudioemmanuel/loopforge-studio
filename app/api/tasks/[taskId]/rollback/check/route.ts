/**
 * GET /api/tasks/[taskId]/rollback/check
 * Check if a task's execution can be rolled back
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

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

  const executionService = getExecutionService();
  const latestExecution = await executionService.getLatestForTask(taskId);

  if (!latestExecution) {
    return NextResponse.json({
      canRollback: false,
      reason: "No execution found for task",
      commits: [],
    });
  }

  // Check if rollback is possible
  const rollbackCheck = await executionService.canRollback(latestExecution.id);

  // Get commits info
  const commits = await executionService.getCommits(latestExecution.id);
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
