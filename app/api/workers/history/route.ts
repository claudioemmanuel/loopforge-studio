import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { handleError, Errors } from "@/lib/errors";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getTaskService } from "@/lib/contexts/task/api";
import {
  getWorkerMonitoringService,
  type WorkerJobPhase,
} from "@/lib/contexts/execution/api";

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

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const phaseParam = searchParams.get("phase");
  let phase: WorkerJobPhase | "all" | null = null;
  if (phaseParam) {
    if (
      phaseParam === "brainstorming" ||
      phaseParam === "planning" ||
      phaseParam === "executing" ||
      phaseParam === "all"
    ) {
      phase = phaseParam;
    }
  }
  const status = searchParams.get("status") as
    | "completed"
    | "failed"
    | "all"
    | null;
  const search = searchParams.get("search");
  const repoId = searchParams.get("repoId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    // Get user's repos via service
    const repositoryService = getRepositoryService();
    const userRepos = await repositoryService.listUserRepositories(userId);

    if (userRepos.length === 0) {
      return NextResponse.json({
        items: [],
        stats: {
          total: 0,
          completed: 0,
          failed: 0,
          brainstorming: 0,
          planning: 0,
          executing: 0,
        },
        page,
        hasMore: false,
      });
    }

    const repoIds = userRepos.map((r) => r.id);
    const repoMap = new Map(userRepos.map((r) => [r.id, r]));

    // Get tasks for user's repos via service
    const taskService = getTaskService();
    const userTasks = (
      await Promise.all(repoIds.map((id) => taskService.listByRepo(id)))
    ).flat();

    if (userTasks.length === 0) {
      return NextResponse.json({
        items: [],
        stats: {
          total: 0,
          completed: 0,
          failed: 0,
          brainstorming: 0,
          planning: 0,
          executing: 0,
        },
        page,
        hasMore: false,
      });
    }

    const taskIds = userTasks.map((t) => t.id);
    const taskMap = new Map(userTasks.map((t) => [t.id, t]));
    const repoTaskIds =
      repoId && repoIds.includes(repoId)
        ? userTasks.filter((t) => t.repoId === repoId).map((t) => t.id)
        : undefined;

    const searchTaskIds = search
      ? userTasks
          .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
          .map((t) => t.id)
      : undefined;

    if (search && (!searchTaskIds || searchTaskIds.length === 0)) {
      return NextResponse.json({
        items: [],
        stats: {
          total: 0,
          completed: 0,
          failed: 0,
          brainstorming: 0,
          planning: 0,
          executing: 0,
        },
        page,
        hasMore: false,
      });
    }

    const workerMonitoringService = getWorkerMonitoringService();
    const [historyResult, stats] = await Promise.all([
      workerMonitoringService.getHistory({
        taskIds,
        phase,
        status,
        repoTaskIds,
        searchTaskIds,
        limit,
        offset,
      }),
      workerMonitoringService.getHistoryStats({
        taskIds,
        repoTaskIds,
        searchTaskIds,
      }),
    ]);

    const jobs = historyResult.jobs;
    const totalCount = historyResult.totalCount;

    // Build history items
    const items: HistoryItem[] = jobs.map((job) => {
      const task = taskMap.get(job.taskId);
      const repo = task ? repoMap.get(task.repoId) : null;

      // Calculate duration
      let duration: number | undefined;
      if (job.startedAt && job.completedAt) {
        duration = Math.floor(
          (job.completedAt.getTime() - job.startedAt.getTime()) / 1000,
        );
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
    apiLogger.error({ error }, "Error fetching worker history");
    return handleError(error);
  }
}
