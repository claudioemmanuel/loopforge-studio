"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Zap,
  RotateCcw,
  ExternalLink,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  WorkerTimeline,
  CompactTimeline,
  TimelineStageData,
  TimelineStage,
} from "./worker-timeline";

export type WorkerCardStatus =
  | "active"
  | "completed"
  | "stuck";

export interface WorkerCardData {
  id: string;
  taskId: string;
  taskTitle: string;
  repoId: string;
  repoName: string;
  repoFullName: string;
  status: WorkerCardStatus;
  progress: number;
  currentStage: TimelineStage;
  stages: TimelineStageData[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  autonomousMode?: boolean;
}

interface WorkerCardProps {
  worker: WorkerCardData;
  defaultExpanded?: boolean;
  onRetry?: (taskId: string) => void;
  onViewDetails?: (taskId: string, repoId: string) => void;
  onCancel?: (taskId: string) => void;
  className?: string;
}

/**
 * Format relative time
 */
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

/**
 * Calculate duration between two dates
 */
function calculateDuration(start: Date, end?: Date): string {
  const endTime = end || new Date();
  const diffMs = endTime.getTime() - start.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Worker Card Component
 *
 * A card wrapper for autonomous task workers showing:
 * - Task title with Auto badge
 * - Repository name
 * - Progress bar with percentage
 * - Embedded WorkerTimeline component
 * - Action buttons for stuck tasks
 * - Collapsed/expanded states
 */
export function WorkerCard({
  worker,
  defaultExpanded,
  onRetry,
  onCancel,
  className,
}: WorkerCardProps) {
  // Auto-expand active workers, collapse completed by default
  const [expanded, setExpanded] = React.useState(
    defaultExpanded ?? (worker.status === "active" || worker.status === "stuck")
  );

  const isActive = worker.status === "active";
  const isStuck = worker.status === "stuck";
  const isCompleted = worker.status === "completed";

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        isStuck && "border-amber-500/50 bg-amber-500/5",
        isActive && "border-primary/30",
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-start gap-3 p-4 text-left",
          "hover:bg-muted/30 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
        )}
      >
        {/* Expand/collapse indicator */}
        <div className="mt-0.5 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm truncate">
                {worker.taskTitle}
              </span>
              {/* Auto badge - only show for autonomous mode tasks */}
              {worker.autonomousMode && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0",
                    "bg-primary/10 text-primary"
                  )}
                >
                  <Zap className="w-2.5 h-2.5" />
                  Auto
                </span>
              )}
            </div>

            {/* Time indicator */}
            <span className="text-xs text-muted-foreground shrink-0">
              {isCompleted
                ? formatRelativeTime(worker.completedAt || worker.startedAt)
                : calculateDuration(worker.startedAt)}
            </span>
          </div>

          {/* Repository */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="w-3 h-3" />
            <span className="truncate">{worker.repoName}</span>
          </div>

          {/* Progress bar (only when not expanded) */}
          {!expanded && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    isStuck ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${worker.progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">
                {worker.progress}%
              </span>
            </div>
          )}

          {/* Compact timeline when collapsed */}
          {!expanded && (
            <CompactTimeline
              currentStage={worker.currentStage}
              progress={worker.progress}
            />
          )}

          {/* Error message for stuck workers */}
          {isStuck && worker.error && !expanded && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-400 line-clamp-1">
                {worker.error}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Progress bar */}
          <div className="ml-7">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-medium">{worker.progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isStuck ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${worker.progress}%` }}
              />
            </div>
          </div>

          {/* Full timeline */}
          <div className="ml-7">
            <WorkerTimeline stages={worker.stages} />
          </div>

          {/* Error message for stuck workers */}
          {isStuck && worker.error && (
            <div className="ml-7 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Task is stuck
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  {worker.error}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="ml-7 flex items-center gap-2">
            {isStuck && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry?.(worker.taskId);
                  }}
                  className="h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel?.(worker.taskId);
                  }}
                  className="h-8"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              </>
            )}

            {isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.(worker.taskId);
                }}
                className="h-8 text-destructive hover:text-destructive"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/workers/${worker.taskId}`;
              }}
              className="h-8 ml-auto"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              View details
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Loading skeleton for WorkerCard
 */
export function WorkerCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 bg-muted rounded w-48 animate-pulse" />
              <div className="h-4 bg-muted rounded w-12 animate-pulse" />
            </div>
            <div className="h-3 bg-muted rounded w-32 animate-pulse" />
            <div className="h-1.5 bg-muted rounded-full w-full animate-pulse" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Empty state when no workers
 */
export function WorkerEmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-foreground mb-1">No tasks processing</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Tasks will appear here when they&apos;re processing (brainstorming, planning, or
        executing).
      </p>
    </div>
  );
}
