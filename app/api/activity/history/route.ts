import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, executions, repos, tasks, executionCommits } from "@/lib/db";
import { eq, and, desc, inArray, count } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  if (!repoId) {
    return handleError(Errors.invalidRequest("repoId is required"));
  }

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  // Get all tasks for this repo
  const repoTasks = await db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
    columns: { id: true, title: true },
  });

  if (repoTasks.length === 0) {
    return NextResponse.json({ executions: [] });
  }

  const taskIds = repoTasks.map((t) => t.id);
  const taskMap = new Map(repoTasks.map((t) => [t.id, t]));

  // Get executions for these tasks (completed or failed)
  const repoExecutions = await db
    .select({
      id: executions.id,
      taskId: executions.taskId,
      status: executions.status,
      branch: executions.branch,
      prUrl: executions.prUrl,
      prNumber: executions.prNumber,
      createdAt: executions.createdAt,
      completedAt: executions.completedAt,
      reverted: executions.reverted,
    })
    .from(executions)
    .where(
      and(
        inArray(executions.taskId, taskIds),
        inArray(executions.status, ["completed", "failed"]),
      ),
    )
    .orderBy(desc(executions.createdAt))
    .limit(limit);

  // Get commit counts for each execution
  const executionIds = repoExecutions.map((e) => e.id);
  const commitCounts =
    executionIds.length > 0
      ? await db
          .select({
            executionId: executionCommits.executionId,
            count: count(),
          })
          .from(executionCommits)
          .where(inArray(executionCommits.executionId, executionIds))
          .groupBy(executionCommits.executionId)
      : [];

  const commitCountMap = new Map(
    commitCounts.map((c) => [c.executionId, Number(c.count)]),
  );

  // Enrich with task info and commit counts
  const enrichedExecutions = repoExecutions.map((execution) => ({
    ...execution,
    task: taskMap.get(execution.taskId) || {
      id: execution.taskId,
      title: "Unknown",
    },
    _count: {
      commits: commitCountMap.get(execution.id) || 0,
    },
  }));

  return NextResponse.json({ executions: enrichedExecutions });
});
