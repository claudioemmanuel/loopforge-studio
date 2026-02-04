/**
 * POST /api/tasks/[taskId]/rollback
 * Rollback (revert) commits made by a completed execution
 */

import { NextResponse } from "next/server";
import {
  canRollback,
  getCommitsByExecution,
  markAllCommitsReverted,
  markExecutionReverted,
} from "@/lib/db/execution-commits";
import { revertCommits } from "@/lib/ralph/git-operations";
import type { StatusHistoryEntry } from "@/lib/db/schema";
import { withTask } from "@/lib/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

export const POST = withTask(async (request, { user, task, taskId }) => {
  const executionService = getExecutionService();
  const latestExecution = await executionService.getLatestForTask(taskId);

  if (!latestExecution) {
    return NextResponse.json(
      { error: "No execution found for task" },
      { status: 400 },
    );
  }

  // Check if rollback is possible
  const rollbackCheck = await canRollback(latestExecution.id);
  if (!rollbackCheck.canRollback) {
    return NextResponse.json(
      { error: rollbackCheck.reason || "Cannot rollback" },
      { status: 400 },
    );
  }

  // Parse request body for options
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || "Rollback requested by user";

  try {
    // Get commits to revert
    const commits = await getCommitsByExecution(latestExecution.id);
    if (commits.length === 0) {
      return NextResponse.json(
        { error: "No commits to revert" },
        { status: 400 },
      );
    }

    // Get the commit SHAs (in reverse order - newest first)
    const commitShas = commits
      .filter((c) => !c.isReverted)
      .map((c) => c.commitSha);

    if (commitShas.length === 0) {
      return NextResponse.json(
        { error: "All commits already reverted" },
        { status: 400 },
      );
    }

    // Perform the revert using git
    const repoPath = task.repo.localPath;
    if (!repoPath) {
      return NextResponse.json(
        { error: "Repository not cloned locally" },
        { status: 400 },
      );
    }

    const revertResult = await revertCommits({
      repoPath,
      branch: task.branch || task.repo.defaultBranch,
      commitShas,
      message: `[LoopForge] Revert: ${task.title}\n\nReason: ${reason}`,
    });

    // Mark commits as reverted
    await markAllCommitsReverted(latestExecution.id, revertResult.revertSha);

    // Mark execution as reverted
    await markExecutionReverted(
      latestExecution.id,
      revertResult.revertSha,
      reason,
    );

    // Update task status to stuck
    const taskService = getTaskService();
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: "stuck",
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: user.id,
    };

    await taskService.updateFields(taskId, {
      status: "stuck",
      statusHistory: [...(task.statusHistory || []), historyEntry],
    });

    const updatedTask = await taskService.getTaskFull(taskId);

    return NextResponse.json({
      success: true,
      task: updatedTask,
      revert: {
        sha: revertResult.revertSha,
        revertedCommits: commitShas,
        reason,
      },
    });
  } catch (error) {
    console.error("Error performing rollback:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rollback" },
      { status: 500 },
    );
  }
});
