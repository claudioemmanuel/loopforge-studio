import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, repos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import { buildDependencyMap } from "@/lib/graph/layout";
import type { ExecutionGraph } from "@/lib/execution/graph-types";

/**
 * GET /api/repos/[repoId]/graph
 * Fetch all tasks with dependencies and execution graphs for graph view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository not found"));
  }

  // Fetch all tasks for this repository
  const allTasks = await db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  // Build dependency map
  const dependencies = buildDependencyMap(allTasks);

  // Build execution graphs map for active tasks
  const executionGraphs: Record<string, ExecutionGraph> = {};

  // Get execution graphs from tasks table (stored as JSONB)
  for (const task of allTasks) {
    if (
      task.executionGraph &&
      ["executing", "stuck", "failed", "review"].includes(task.status)
    ) {
      executionGraphs[task.id] = task.executionGraph;
    }
  }

  return NextResponse.json({
    tasks: allTasks,
    dependencies,
    executions: executionGraphs,
  });
}
