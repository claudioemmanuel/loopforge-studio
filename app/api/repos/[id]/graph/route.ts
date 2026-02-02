import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { buildDependencyMap } from "@/lib/graph/layout";
import type { ExecutionGraph } from "@/lib/execution/graph-types";

/**
 * GET /api/repos/[id]/graph
 * Fetch all tasks with dependencies and execution graphs for graph view
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { id: repoId } = await params;

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
  },
);
