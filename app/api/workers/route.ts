import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, repos, executions } from "@/lib/db";
import { eq, and, inArray, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all"; // all, active, completed, stuck

  // Get user's repos
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, session.user.id),
  });

  if (userRepos.length === 0) {
    return NextResponse.json([]);
  }

  const repoIds = userRepos.map((r) => r.id);
  const repoMap = new Map(userRepos.map((r) => [r.id, r]));

  // Build status filter
  let statusFilter: string[] = [];
  switch (filter) {
    case "active":
      statusFilter = ["brainstorming", "planning", "ready", "executing"];
      break;
    case "completed":
      statusFilter = ["done"];
      break;
    case "stuck":
      statusFilter = ["stuck"];
      break;
    default:
      statusFilter = ["brainstorming", "planning", "ready", "executing", "done", "stuck"];
  }

  // Query autonomous tasks
  const autonomousTasks = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.repoId, repoIds),
      eq(tasks.autonomousMode, true),
      inArray(tasks.status, statusFilter as any)
    ),
    orderBy: [desc(tasks.updatedAt)],
    limit: 50,
  });

  // Get executions for these tasks
  const taskIds = autonomousTasks.map((t) => t.id);
  const taskExecutions =
    taskIds.length > 0
      ? await db.query.executions.findMany({
          where: inArray(executions.taskId, taskIds),
          orderBy: [desc(executions.createdAt)],
        })
      : [];

  // Map executions to tasks
  const executionMap = new Map<string, typeof taskExecutions[0]>();
  for (const exec of taskExecutions) {
    // Keep only the latest execution per task
    if (!executionMap.has(exec.taskId)) {
      executionMap.set(exec.taskId, exec);
    }
  }

  // Build response
  const workers = autonomousTasks.map((task) => {
    const repo = repoMap.get(task.repoId);
    const execution = executionMap.get(task.id);

    // Calculate progress
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
        // Keep last known progress
        progress = execution?.iteration ? Math.min(60 + execution.iteration * 5, 95) : 50;
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
      brainstormResult: task.brainstormResult ? JSON.parse(task.brainstormResult) : null,
      planContent: task.planContent ? JSON.parse(task.planContent) : null,
      startedAt: execution?.startedAt?.toISOString(),
      completedAt: execution?.completedAt?.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
    };
  });

  return NextResponse.json(workers);
}
