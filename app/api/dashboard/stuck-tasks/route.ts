import { NextResponse } from "next/server";
import { db, tasks, repos, executions } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export interface StuckTaskInfo {
  id: string;
  title: string;
  status: string;
  processingPhase: string | null;
  repoId: string;
  repoName: string;
  isRecovering: boolean;
  recoveryAttemptCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StuckTasksResponse {
  stuckTasks: StuckTaskInfo[];
  recoveringTasks: StuckTaskInfo[];
  totalCount: number;
}

export const GET = withAuth(async (request, { user }) => {
  // Find all tasks for this user that are stuck or recovering
  const userTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.status, "stuck"),
      inArray(
        tasks.repoId,
        db
          .select({ id: repos.id })
          .from(repos)
          .where(eq(repos.userId, user.id))
      )
    ),
    with: {
      repo: true,
    },
    orderBy: (tasks, { desc }) => [desc(tasks.updatedAt)],
  });

  // Get latest executions for these tasks
  const taskIds = userTasks.map((t) => t.id);
  const latestExecutions = taskIds.length > 0
    ? await db.query.executions.findMany({
        where: inArray(executions.taskId, taskIds),
        orderBy: (executions, { desc }) => [desc(executions.createdAt)],
      })
    : [];

  // Create a map of taskId to latest execution
  const executionMap = new Map<string, typeof latestExecutions[0]>();
  for (const execution of latestExecutions) {
    if (!executionMap.has(execution.taskId)) {
      executionMap.set(execution.taskId, execution);
    }
  }

  // Build response data
  const stuckTasks: StuckTaskInfo[] = [];
  const recoveringTasks: StuckTaskInfo[] = [];

  for (const task of userTasks) {
    const execution = executionMap.get(task.id);
    const recoveryAttempts = (execution?.recoveryAttempts as Array<{
      tier: string;
      success: boolean;
      iteration: number;
    }>) || [];
    const isRecovering = task.processingPhase === "recovering";

    const taskInfo: StuckTaskInfo = {
      id: task.id,
      title: task.title,
      status: task.status,
      processingPhase: task.processingPhase,
      repoId: task.repoId,
      repoName: task.repo?.name || "Unknown",
      isRecovering,
      recoveryAttemptCount: recoveryAttempts.length,
      lastError: execution?.errorMessage || undefined,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    if (isRecovering) {
      recoveringTasks.push(taskInfo);
    } else {
      stuckTasks.push(taskInfo);
    }
  }

  const response: StuckTasksResponse = {
    stuckTasks,
    recoveringTasks,
    totalCount: stuckTasks.length + recoveringTasks.length,
  };

  return NextResponse.json(response);
});
