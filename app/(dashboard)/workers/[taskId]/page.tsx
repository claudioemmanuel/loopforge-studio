"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GitBranch,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExecutionTimeline } from "@/components/workers/execution-timeline";
import type { Task, Execution, ExecutionEvent, Repo } from "@/lib/db/schema";

interface WorkerDetailData {
  task: Task & { repo: Repo };
  execution: Execution | null;
  events: ExecutionEvent[];
}

function getStatusBadge(task: Task & { repo: Repo }) {
  // Check if processing phase is complete
  const isProcessingComplete = task.processingProgress === 100 &&
    task.processingStatusText?.toLowerCase().includes("complete");

  // Determine effective status
  let effectiveStatus = task.status;
  if (isProcessingComplete && task.processingPhase === task.status) {
    // Processing is complete, show "Ready" instead of the processing phase
    effectiveStatus = "ready";
  }

  switch (effectiveStatus) {
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    case "stuck":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Stuck
        </span>
      );
    case "executing":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Executing
        </span>
      );
    case "brainstorming":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Brainstorming
        </span>
      );
    case "planning":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Planning
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ready
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          {effectiveStatus}
        </span>
      );
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [data, setData] = useState<WorkerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/workers/${taskId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Task not found");
        } else if (response.status === 403) {
          setError("You don't have access to this task");
        } else {
          setError("Failed to load worker details");
        }
        return;
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch {
      setError("Failed to load worker details");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE connection for live updates
  useEffect(() => {
    if (!data) return;

    const isActive = ["brainstorming", "planning", "ready", "executing"].includes(data.task.status);
    if (!isActive) return;

    const eventSource = new EventSource(`/api/workers/${taskId}/sse`);

    eventSource.onmessage = () => {
      // Refresh data when we receive an update
      fetchData();
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Try to reconnect after a delay
      setTimeout(() => {
        fetchData();
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
    // Only reconnect SSE when task status changes, not on every data update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, data?.task.status, fetchData]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-96" />
          <div className="h-2 bg-muted rounded-full w-full" />
          <div className="space-y-4">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">{error || "Something went wrong"}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Unable to load worker details.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { task, execution, events } = data;
  const progress = task.processingProgress ?? 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 -ml-2"
              onClick={() => router.push("/workers")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Workers
            </Button>
          </div>

          <h1 className="text-2xl font-bold flex items-center gap-3">
            {task.title}
            {task.autonomousMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase bg-primary/10 text-primary">
                <Zap className="w-3 h-3" />
                Auto
              </span>
            )}
          </h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-4 h-4" />
              <span>{task.repo.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Started {formatRelativeTime(new Date(task.createdAt))}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(task)}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="h-8"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-sm font-medium tabular-nums">{progress}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              task.status === "stuck" ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {task.processingStatusText && (
          <p className="text-xs text-muted-foreground mt-2">{task.processingStatusText}</p>
        )}
      </div>

      {/* Error message if stuck */}
      {task.status === "stuck" && execution?.errorMessage && (
        <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Task is stuck</p>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                {execution.errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-6">
          Timeline
        </h2>
        <ExecutionTimeline task={task} execution={execution} events={events} />
      </div>

      {/* Task description */}
      {task.description && (
        <div className="mt-6 bg-card border rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Description
          </h2>
          <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* View on Kanban link */}
      <div className="mt-6 flex justify-center">
        <Link href={`/repos/${task.repoId}?task=${task.id}`}>
          <Button variant="outline">View on Kanban Board</Button>
        </Link>
      </div>
    </div>
  );
}
