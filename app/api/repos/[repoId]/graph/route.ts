import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { buildDependencyMap } from "@/lib/shared/graph-layout";
import type { ExecutionGraph } from "@/lib/shared/graph-types";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getTaskService } from "@/lib/contexts/task/api";

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

  const repositoryService = getRepositoryService();
  const taskService = getTaskService();

  // Verify repo ownership
  const repo = await repositoryService.findByOwner(repoId, session.user.id);

  if (!repo) {
    return handleError(Errors.notFound("Repository not found"));
  }

  // Fetch all tasks for this repository
  const allTasks = await taskService.listByRepo(repoId);

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
