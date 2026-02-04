import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getTaskService } from "@/lib/contexts/task/api";

export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";

  const taskService = getTaskService();
  const {
    tasks: workerTasks,
    repoMap,
    executionMap,
  } = await taskService.listActiveWorkerTasks(user.id, filter);

  if (workerTasks.length === 0) {
    return NextResponse.json([]);
  }

  // Build response with progress calculation (presentation logic stays in route)
  const workers = workerTasks.map((task) => {
    const repo = repoMap.get(task.repoId);
    const execution = executionMap.get(task.id);

    let progress = 0;
    let currentStep: string | undefined;
    let currentAction: string | undefined;

    switch (task.status) {
      case "brainstorming":
        progress = 20;
        currentAction = "Generating ideas...";
        break;
      case "planning":
        progress = 40;
        currentAction = "Creating execution plan...";
        break;
      case "ready":
        progress = 60;
        currentAction = "Ready to execute";
        break;
      case "executing":
        progress = 80;
        currentAction = "Executing...";
        break;
      case "done":
        progress = 100;
        break;
      case "stuck":
        progress = execution?.iteration
          ? Math.min(60 + execution.iteration * 5, 95)
          : 50;
        break;
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      repoId: task.repoId,
      repoName: repo?.name || "Unknown",
      status: task.status,
      progress,
      currentStep,
      currentAction,
      error: execution?.errorMessage || undefined,
      branch: task.branch,
      brainstormResult: task.brainstormResult
        ? JSON.parse(task.brainstormResult)
        : null,
      planContent: task.planContent ? JSON.parse(task.planContent) : null,
      startedAt: execution?.startedAt?.toISOString(),
      completedAt: execution?.completedAt?.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
    };
  });

  return NextResponse.json(workers);
});
