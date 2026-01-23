import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, repos, workerJobs, workerEvents } from "@/lib/db";
import type { WorkerJobPhase, WorkerJobStatus } from "@/lib/db/schema";
import { eq, and, inArray, desc, or, sql, ilike } from "drizzle-orm";

export const runtime = "nodejs";

// Type for worker event in history
interface HistoryWorkerEvent {
  id: string;
  eventType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Type for the history item response
interface HistoryItem {
  id: string;
  taskId: string;
  taskTitle: string;
  repoId: string;
  repoName: string;
  phase: WorkerJobPhase;
  status: "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  resultSummary?: string;
  error?: string;
  events?: HistoryWorkerEvent[];
}

// Stats response
interface HistoryStats {
  total: number;
  completed: number;
  failed: number;
  brainstorming: number;
  planning: number;
  executing: number;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const phase = searchParams.get("phase") as WorkerJobPhase | "all" | null;
  const status = searchParams.get("status") as "completed" | "failed" | "all" | null;
  const search = searchParams.get("search");
  const repoId = searchParams.get("repoId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    // Get user's repos
    const userRepos = await db.query.repos.findMany({
      where: eq(repos.userId, userId),
    });

    if (userRepos.length === 0) {
      return NextResponse.json({
        items: [],
        stats: { total: 0, completed: 0, failed: 0, brainstorming: 0, planning: 0, executing: 0 },
        page,
        hasMore: false,
      });
    }

    const repoIds = userRepos.map((r) => r.id);
    const repoMap = new Map(userRepos.map((r) => [r.id, r]));

    // Get task IDs for user's repos
    const userTasks = await db.query.tasks.findMany({
      where: inArray(tasks.repoId, repoIds),
      columns: { id: true, title: true, repoId: true },
    });

    if (userTasks.length === 0) {
      return NextResponse.json({
        items: [],
        stats: { total: 0, completed: 0, failed: 0, brainstorming: 0, planning: 0, executing: 0 },
        page,
        hasMore: false,
      });
    }

    const taskIds = userTasks.map((t) => t.id);
    const taskMap = new Map(userTasks.map((t) => [t.id, t]));

    // Build conditions for worker_jobs query
    const conditions = [
      inArray(workerJobs.taskId, taskIds),
      // Only show completed or failed jobs (not running/queued)
      inArray(workerJobs.status, ["completed", "failed"] as WorkerJobStatus[]),
    ];

    // Filter by phase
    if (phase && phase !== "all") {
      conditions.push(eq(workerJobs.phase, phase));
    }

    // Filter by status
    if (status === "completed") {
      conditions.push(eq(workerJobs.status, "completed"));
    } else if (status === "failed") {
      conditions.push(eq(workerJobs.status, "failed"));
    }

    // Filter by repo
    if (repoId && repoIds.includes(repoId)) {
      const repoTaskIds = userTasks.filter((t) => t.repoId === repoId).map((t) => t.id);
      if (repoTaskIds.length > 0) {
        conditions.push(inArray(workerJobs.taskId, repoTaskIds));
      }
    }

    // Search filter (search in task titles)
    if (search) {
      const matchingTaskIds = userTasks
        .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
        .map((t) => t.id);
      if (matchingTaskIds.length > 0) {
        conditions.push(inArray(workerJobs.taskId, matchingTaskIds));
      } else {
        // No matching tasks, return empty
        return NextResponse.json({
          items: [],
          stats: { total: 0, completed: 0, failed: 0, brainstorming: 0, planning: 0, executing: 0 },
          page,
          hasMore: false,
        });
      }
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workerJobs)
      .where(and(...conditions));

    const totalCount = Number(countResult[0]?.count || 0);

    // Query worker jobs
    const jobs = await db.query.workerJobs.findMany({
      where: and(...conditions),
      orderBy: [desc(workerJobs.completedAt), desc(workerJobs.createdAt)],
      limit: limit,
      offset: offset,
      with: {
        events: {
          limit: 10,
          orderBy: [desc(workerEvents.createdAt)],
        },
      },
    });

    // Calculate stats (for all matching jobs, not just current page)
    const statsConditions = [
      inArray(workerJobs.taskId, taskIds),
      inArray(workerJobs.status, ["completed", "failed"] as WorkerJobStatus[]),
    ];

    // Apply same filters to stats (except pagination)
    if (repoId && repoIds.includes(repoId)) {
      const repoTaskIds = userTasks.filter((t) => t.repoId === repoId).map((t) => t.id);
      if (repoTaskIds.length > 0) {
        statsConditions.push(inArray(workerJobs.taskId, repoTaskIds));
      }
    }

    if (search) {
      const matchingTaskIds = userTasks
        .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
        .map((t) => t.id);
      if (matchingTaskIds.length > 0) {
        statsConditions.push(inArray(workerJobs.taskId, matchingTaskIds));
      }
    }

    const statsResult = await db.select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${workerJobs.status} = 'completed')`,
      failed: sql<number>`count(*) filter (where ${workerJobs.status} = 'failed')`,
      brainstorming: sql<number>`count(*) filter (where ${workerJobs.phase} = 'brainstorming')`,
      planning: sql<number>`count(*) filter (where ${workerJobs.phase} = 'planning')`,
      executing: sql<number>`count(*) filter (where ${workerJobs.phase} = 'executing')`,
    })
    .from(workerJobs)
    .where(and(...statsConditions));

    const stats: HistoryStats = {
      total: Number(statsResult[0]?.total || 0),
      completed: Number(statsResult[0]?.completed || 0),
      failed: Number(statsResult[0]?.failed || 0),
      brainstorming: Number(statsResult[0]?.brainstorming || 0),
      planning: Number(statsResult[0]?.planning || 0),
      executing: Number(statsResult[0]?.executing || 0),
    };

    // Build history items
    const items: HistoryItem[] = jobs.map((job) => {
      const task = taskMap.get(job.taskId);
      const repo = task ? repoMap.get(task.repoId) : null;

      // Calculate duration
      let duration: number | undefined;
      if (job.startedAt && job.completedAt) {
        duration = Math.floor((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
      }

      return {
        id: job.id,
        taskId: job.taskId,
        taskTitle: task?.title || "Unknown Task",
        repoId: task?.repoId || "",
        repoName: repo?.name || "Unknown",
        phase: job.phase,
        status: job.status === "completed" ? "completed" : "failed",
        startedAt: (job.startedAt || job.createdAt).toISOString(),
        completedAt: job.completedAt?.toISOString(),
        duration,
        resultSummary: job.resultSummary || undefined,
        error: job.errorMessage || undefined,
        events: job.events?.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          content: e.content,
          metadata: e.metadata as Record<string, unknown> | null,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    });

    return NextResponse.json({
      items,
      stats,
      page,
      hasMore: offset + items.length < totalCount,
    });
  } catch (error) {
    console.error("Error fetching worker history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
