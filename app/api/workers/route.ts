import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, tasks, repos, executions } from "@/lib/db";
import type { TaskStatus, Execution } from "@/lib/db/schema";
import { eq, and, or, inArray, desc, isNotNull } from "drizzle-orm";

export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all"; // all, active, completed, stuck

  // Get user's repos
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, user.id),
  });

  if (userRepos.length === 0) {
    return NextResponse.json([]);
  }

  const repoIds = userRepos.map((r) => r.id);
  const repoMap = new Map(userRepos.map((r) => [r.id, r]));

  // Build status filter based on requested filter
  let statusFilter: TaskStatus[];
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
      statusFilter = [
        "brainstorming",
        "planning",
        "ready",
        "executing",
        "done",
        "stuck",
      ];
  }

  // Query tasks with ACTIVE workers:
  // 1. Autonomous mode tasks (legacy)
  // 2. Tasks currently processing (processingPhase set - background job running)
  // 3. Tasks that failed (stuck status)
  const workerTasks = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.repoId, repoIds),
      inArray(tasks.status, statusFilter),
      or(
        // Autonomous mode tasks (legacy)
        eq(tasks.autonomousMode, true),
        // Any task currently processing (background job running)
        isNotNull(tasks.processingPhase),
        // Failed tasks
        eq(tasks.status, "stuck" as TaskStatus),
      ),
    ),
    orderBy: [desc(tasks.updatedAt)],
    limit: 50,
  });

  // Alias for backwards compatibility
  const autonomousTasks = workerTasks;

  // Get latest execution per task using Drizzle ORM for safety
  const taskIds = autonomousTasks.map((t) => t.id);
  const executionMap = new Map<string, Execution>();

  if (taskIds.length > 0) {
    // Use Drizzle's inArray for safe parameterized queries (no SQL injection risk)
    // Then deduplicate in JS - simpler and safer than raw SQL
    const allExecutions = await db.query.executions.findMany({
      where: inArray(executions.taskId, taskIds),
      orderBy: [desc(executions.createdAt)],
    });

    // Keep only the latest execution per task
    for (const exec of allExecutions) {
      if (!executionMap.has(exec.taskId)) {
        executionMap.set(exec.taskId, exec);
      }
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
