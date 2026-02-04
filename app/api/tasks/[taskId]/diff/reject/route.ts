/**
 * POST /api/tasks/[taskId]/diff/reject
 * Reject pending changes and move task back to stuck or planning
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deletePendingChangesByTask } from "@/lib/db/pending-changes";
import { deleteTestRunsByExecution } from "@/lib/db/test-runs";
import { discardBranchChanges } from "@/lib/ralph/git-operations";
import type { StatusHistoryEntry, TaskStatus } from "@/lib/db/schema";
import { handleError, Errors } from "@/lib/errors";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

export async function POST(
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

  // Task must be in review status
  if (task.status !== "review") {
    return handleError(
      Errors.invalidRequest(
        `Cannot reject changes: task status is ${task.status}`,
      ),
    );
  }

  // Parse request body for options
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || "Changes rejected by user";
  const targetStatus: TaskStatus =
    body.targetStatus === "planning" ? "planning" : "stuck";

  const executionService = getExecutionService();
  const latestExecution = await executionService.getLatestForTask(taskId);

  try {
    // Discard uncommitted changes in the repo
    if (task.repo.localPath && task.branch) {
      await discardBranchChanges({
        repoPath: task.repo.localPath,
        branch: task.branch,
      });
    }

    // Clean up pending changes
    await deletePendingChangesByTask(taskId);

    // Clean up test runs and mark execution as failed
    if (latestExecution) {
      await deleteTestRunsByExecution(latestExecution.id);
      await executionService.markFailed(latestExecution.id, reason);
    }

    // Update task status
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: targetStatus,
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: session.user.id,
    };

    await taskService.updateFields(taskId, {
      status: targetStatus,
      statusHistory: [...(task.statusHistory || []), historyEntry],
    });

    const updatedTask = await taskService.getTaskFull(taskId);

    return NextResponse.json({
      success: true,
      task: updatedTask,
      reason,
    });
  } catch (error) {
    return handleError(error);
  }
}
