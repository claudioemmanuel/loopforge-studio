import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

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
  const taskService = getTaskService();
  const repositoryService = getRepositoryService();
  const executionService = getExecutionService();

  const [allUserTasks, userRepos] = await Promise.all([
    taskService.listByUserId(user.id),
    repositoryService.listUserRepositories(user.id),
  ]);

  const repoMap = new Map(userRepos.map((repo) => [repo.id, repo]));
  const userTasks = allUserTasks
    .filter((task) => task.status === "stuck")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // Get latest executions for these tasks
  const taskIds = userTasks.map((t) => t.id);
  const latestExecutions = await Promise.all(
    taskIds.map(async (taskId) => executionService.getLatestForTask(taskId)),
  );

  // Create a map of taskId to latest execution
  const executionMap = new Map<
    string,
    (typeof latestExecutions)[number] | null
  >();
  for (let i = 0; i < taskIds.length; i++) {
    const execution = latestExecutions[i];
    if (execution) {
      executionMap.set(taskIds[i], execution);
    }
  }

  // Build response data
  const stuckTasks: StuckTaskInfo[] = [];
  const recoveringTasks: StuckTaskInfo[] = [];

  for (const task of userTasks) {
    const execution = executionMap.get(task.id);
    const recoveryAttempts =
      (execution?.recoveryAttempts as Array<{
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
      repoName: repoMap.get(task.repoId)?.name || "Unknown",
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
