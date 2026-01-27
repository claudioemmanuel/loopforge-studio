/**
 * POST /api/tasks/[taskId]/diff/reject
 * Reject pending changes and move task back to stuck or planning
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, executions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { deletePendingChangesByTask } from "@/lib/db/pending-changes";
import { deleteTestRunsByExecution } from "@/lib/db/test-runs";
import { discardBranchChanges } from "@/lib/ralph/git-operations";
import type { StatusHistoryEntry, TaskStatus } from "@/lib/db/schema";

export async function POST(
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

  // Task must be in review status
  if (task.status !== "review") {
    return NextResponse.json(
      { error: `Cannot reject changes: task status is ${task.status}` },
      { status: 400 },
    );
  }

  // Parse request body for options
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || "Changes rejected by user";
  const targetStatus: TaskStatus =
    body.targetStatus === "planning" ? "planning" : "stuck";

  const latestExecution = task.executions?.[0];

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

    // Clean up test runs for this execution
    if (latestExecution) {
      await deleteTestRunsByExecution(latestExecution.id);

      // Mark execution as failed
      await db
        .update(executions)
        .set({
          status: "failed",
          errorMessage: reason,
          completedAt: new Date(),
        })
        .where(eq(executions.id, latestExecution.id));
    }

    // Update task status
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: targetStatus,
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: session.user.id,
    };

    await db
      .update(tasks)
      .set({
        status: targetStatus,
        statusHistory: [...(task.statusHistory || []), historyEntry],
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Fetch updated task
    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      reason,
    });
  } catch (error) {
    console.error("Error rejecting changes:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reject changes",
      },
      { status: 500 },
    );
  }
}
