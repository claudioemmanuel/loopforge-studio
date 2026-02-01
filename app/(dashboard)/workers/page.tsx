"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { clientLogger } from "@/lib/logger";
import {
  Zap,
  AlertTriangle,
  Loader2,
  RefreshCw,
  History,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  WorkerCard,
  WorkerCardSkeleton,
  type WorkerCardData,
} from "@/components/workers/worker-card";
import {
  createDefaultTimeline,
  type TimelineStage,
} from "@/components/workers/worker-timeline";
import {
  useWorkerEvents,
  type WorkerEventData,
} from "@/components/hooks/use-worker-events";

// Convert WorkerEventData to WorkerCardData
function toWorkerCardData(worker: WorkerEventData): WorkerCardData {
  const status =
    worker.status === "done"
      ? "completed"
      : worker.status === "stuck"
        ? "stuck"
        : "active";

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
    autonomousMode: worker.autonomousMode,
  };
}

export default function WorkersPage() {
  const t = useTranslations("workers");
  const { workers, activeCount, stuckCount, isConnected, error, refresh } =
    useWorkerEvents();

  // Get only active workers (processingPhase set or stuck status)
  const activeWorkers = useMemo(() => {
    return workers.filter(
      (worker) =>
        ["brainstorming", "planning", "ready", "executing"].includes(
          worker.status,
        ) || worker.status === "stuck",
    );
  }, [workers]);

  // Convert to card data
  const workerCards = useMemo(() => {
    return activeWorkers.map(toWorkerCardData);
  }, [activeWorkers]);

  const handleRetry = async (taskId: string) => {
    try {
      await fetch(`/api/workers/${taskId}/retry`, { method: "POST" });
      refresh();
    } catch (err) {
      clientLogger.error("Failed to retry worker", { error: err });
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await fetch(`/api/workers/${taskId}/cancel`, { method: "POST" });
      refresh();
    } catch (err) {
      clientLogger.error("Failed to cancel worker", { error: err });
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            Active Workers
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time view of tasks being processed
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-amber-500 animate-pulse",
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
            title={t("refreshTitle")}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          {activeCount > 0 ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Zap className="w-5 h-5 text-primary" />
          )}
          <div>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">{t("stats.active")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-2xl font-bold">{stuckCount}</p>
            <p className="text-xs text-muted-foreground">{t("stats.failed")}</p>
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
      {!isConnected && workers.length === 0 ? (
        // Loading state
        <div className="space-y-4">
          <WorkerCardSkeleton />
          <WorkerCardSkeleton />
          <WorkerCardSkeleton />
        </div>
      ) : workerCards.length > 0 ? (
        // Active workers list
        <div className="space-y-4">
          {workerCards.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onRetry={handleRetry}
              onCancel={handleCancel}
            />
          ))}
        </div>
      ) : (
        // Empty state
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            No active workers
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Tasks will appear here when they&apos;re being processed
            (brainstorming, planning, or executing).
          </p>
          <Link href="/workers/history">
            <Button variant="outline" size="sm" className="gap-2">
              <History className="w-4 h-4" />
              View execution history
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Quick link to history when there are active workers */}
      {workerCards.length > 0 && (
        <div className="mt-8 pt-6 border-t">
          <Link
            href="/workers/history"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="w-4 h-4" />
            View execution history
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
