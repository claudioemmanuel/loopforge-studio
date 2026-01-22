"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Zap,
  Filter,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WorkerCard,
  WorkerCardSkeleton,
  WorkerEmptyState,
  type WorkerCardData,
} from "@/components/workers/worker-card";
import { createDefaultTimeline, type TimelineStage } from "@/components/workers/worker-timeline";
import { useWorkerEvents, type WorkerEventData } from "@/components/hooks/use-worker-events";

type FilterOption = "all" | "active" | "completed" | "stuck";

const filterLabels: Record<FilterOption, string> = {
  all: "All Workers",
  active: "Active",
  completed: "Completed",
  stuck: "Stuck",
};

// Convert WorkerEventData to WorkerCardData
function toWorkerCardData(worker: WorkerEventData): WorkerCardData {
  const status =
    worker.status === "done" ? "completed" :
    worker.status === "stuck" ? "stuck" :
    "active";

  const currentStage = worker.status as TimelineStage;

  // Build stage data with current action if available
  const stageData = worker.currentAction
    ? { [currentStage]: { currentAction: worker.currentAction } }
    : undefined;

  return {
    id: worker.taskId,
    taskId: worker.taskId,
    taskTitle: worker.taskTitle,
    repoId: worker.repoId,
    repoName: worker.repoName,
    repoFullName: worker.repoName,
    status,
    progress: worker.progress,
    currentStage,
    stages: createDefaultTimeline(currentStage, stageData),
    error: worker.error,
    startedAt: new Date(worker.updatedAt),
    completedAt: worker.completedAt ? new Date(worker.completedAt) : undefined,
  };
}

export default function WorkersPage() {
  const [filter, setFilter] = useState<FilterOption>("all");

  const {
    workers,
    activeCount,
    stuckCount,
    isConnected,
    error,
    refresh
  } = useWorkerEvents();

  // Filter workers based on selected filter
  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      if (filter === "all") return true;
      if (filter === "active") {
        return ["brainstorming", "planning", "ready", "executing"].includes(worker.status);
      }
      if (filter === "completed") return worker.status === "done";
      if (filter === "stuck") return worker.status === "stuck";
      return true;
    });
  }, [workers, filter]);

  // Convert to card data
  const workerCards = useMemo(() => {
    return filteredWorkers.map(toWorkerCardData);
  }, [filteredWorkers]);

  const handleRetry = async (taskId: string) => {
    try {
      await fetch(`/api/workers/${taskId}/retry`, { method: "POST" });
      refresh();
    } catch (err) {
      console.error("Failed to retry worker:", err);
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await fetch(`/api/workers/${taskId}/cancel`, { method: "POST" });
      refresh();
    } catch (err) {
      console.error("Failed to cancel worker:", err);
    }
  };

  const handleViewDetails = (taskId: string, repoId: string) => {
    // Navigate to task in repo page
    window.location.href = `/repos/${repoId}?task=${taskId}`;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            Workers
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your autonomous task executions
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-amber-500 animate-pulse"
              )}
            />
            <span className="text-muted-foreground">
              {isConnected ? "Live" : "Connecting..."}
            </span>
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            title="Refresh workers"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {filterLabels[filter]}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => setFilter(option)}
                  className={cn(filter === option && "bg-muted")}
                >
                  {filterLabels[option]}
                  {option === "active" && activeCount > 0 && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {activeCount}
                    </span>
                  )}
                  {option === "stuck" && stuckCount > 0 && (
                    <span className="ml-auto text-xs bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">
                      {stuckCount}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          {activeCount > 0 ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Zap className="w-5 h-5 text-primary" />
          )}
          <div>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-2xl font-bold">
              {workers.filter((w) => w.status === "done").length}
            </p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-2xl font-bold">{stuckCount}</p>
            <p className="text-xs text-muted-foreground">Stuck</p>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Worker list */}
      <div className="space-y-4">
        {!isConnected && workerCards.length === 0 ? (
          // Loading state
          <>
            <WorkerCardSkeleton />
            <WorkerCardSkeleton />
            <WorkerCardSkeleton />
          </>
        ) : workerCards.length > 0 ? (
          // Workers list
          workerCards.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onRetry={handleRetry}
              onCancel={handleCancel}
              onViewDetails={handleViewDetails}
            />
          ))
        ) : (
          // Empty state
          <WorkerEmptyState />
        )}
      </div>

      {/* Help text */}
      {workerCards.length === 0 && isConnected && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            To start an autonomous worker, create a task with{" "}
            <span className="font-medium text-primary">Autonomous Mode</span>{" "}
            enabled and click &quot;Start Brainstorming&quot;.
          </p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
