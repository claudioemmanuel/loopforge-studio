"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import Link from "next/link";
import {
  Bell,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Worker status types
export type WorkerStatus =
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "done"
  | "stuck";

export interface WorkerNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  repoName: string;
  status: WorkerStatus;
  progress: number;
  currentStep?: string;
  timestamp: Date;
  error?: string;
}

interface NotificationBellProps {
  workers: WorkerNotification[];
  className?: string;
}

/**
 * Get status indicator icon and color based on worker status
 */
function getStatusIndicator(status: WorkerStatus): {
  icon: React.ReactNode;
  className: string;
  label: string;
} {
  switch (status) {
    case "executing":
      return {
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        className: "text-primary",
        label: "Executing",
      };
    case "brainstorming":
    case "planning":
    case "ready":
      return {
        icon: <CircleDot className="w-3.5 h-3.5" />,
        className: "text-amber-500",
        label: status.charAt(0).toUpperCase() + status.slice(1),
      };
    case "done":
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        className: "text-green-500",
        label: "Completed",
      };
    case "stuck":
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        className: "text-amber-500",
        label: "Failed",
      };
    default:
      return {
        icon: <CircleDot className="w-3.5 h-3.5" />,
        className: "text-muted-foreground",
        label: "Unknown",
      };
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Single worker notification row
 */
function WorkerNotificationRow({
  worker,
  onSelect,
}: {
  worker: WorkerNotification;
  onSelect?: (taskId: string) => void;
}) {
  const status = getStatusIndicator(worker.status);

  return (
    <button
      onClick={() => onSelect?.(worker.taskId)}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left",
        "hover:bg-muted/50 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
    >
      {/* Status indicator */}
      <div className={cn("mt-0.5 shrink-0", status.className)}>
        {status.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{worker.taskTitle}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTimestamp(worker.timestamp)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="w-3 h-3" />
          <span className="truncate">{worker.repoName}</span>
        </div>

        {/* Progress or current step */}
        {worker.status === "executing" && worker.currentStep && (
          <p className="text-xs text-muted-foreground truncate">
            {worker.currentStep}
          </p>
        )}

        {worker.status === "stuck" && worker.error && (
          <p className="text-xs text-destructive truncate">{worker.error}</p>
        )}

        {/* Progress bar for executing tasks */}
        {worker.status === "executing" && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${worker.progress}%` }}
            />
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Notification Bell Component
 *
 * A header notification bell that shows active workers with a dropdown panel.
 * Displays a badge with active count (amber) or stuck indicator (red !).
 */
export function NotificationBell({
  workers,
  className,
}: NotificationBellProps) {
  const [open, setOpen] = React.useState(false);

  // Calculate badge state
  const activeWorkers = workers.filter(
    (w) => w.status !== "done" && w.status !== "stuck"
  );
  const stuckWorkers = workers.filter((w) => w.status === "stuck");
  const hasStuck = stuckWorkers.length > 0;
  const activeCount = activeWorkers.length;

  // Filter out completed workers (they don't need attention)
  // Sort remaining: active first, then stuck (most recent first)
  const sortedWorkers = [...workers]
    .filter((w) => w.status !== "done")
    .sort((a, b) => {
      const statusOrder: Record<WorkerStatus, number> = {
        executing: 0,
        brainstorming: 1,
        planning: 2,
        ready: 3,
        stuck: 4,
        done: 5,
      };
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    })
    .slice(0, 5);

  const handleWorkerSelect = (taskId: string) => {
    // Close popover and navigate or open modal
    setOpen(false);
    // Navigation would be handled by parent or via router
    console.log("Selected worker task:", taskId);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={
            hasStuck
              ? `${stuckWorkers.length} worker${stuckWorkers.length > 1 ? "s" : ""} need attention`
              : activeCount > 0
                ? `${activeCount} active worker${activeCount > 1 ? "s" : ""}`
                : "No active workers"
          }
        >
          <Bell className="w-5 h-5" />

          {/* Badge */}
          {(activeCount > 0 || hasStuck) && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex items-center justify-center",
                "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold",
                "transition-colors",
                hasStuck
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-amber-500 text-white"
              )}
            >
              {hasStuck ? "!" : activeCount}
            </span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Workers</h3>
            {activeCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {activeCount} active
              </span>
            )}
          </div>

          {/* Worker list */}
          <div className="max-h-80 overflow-y-auto">
            {sortedWorkers.length > 0 ? (
              <div className="p-1">
                {sortedWorkers.map((worker) => (
                  <WorkerNotificationRow
                    key={worker.id}
                    worker={worker}
                    onSelect={handleWorkerSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No worker activity
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-2">
            <Link
              href="/workers"
              className={cn(
                "flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg",
                "text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50",
                "transition-colors"
              )}
              onClick={() => setOpen(false)}
            >
              View all workers
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Empty state variant for when SSE is not connected
 */
export function NotificationBellSkeleton({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      disabled
      aria-label="Loading workers..."
    >
      <Bell className="w-5 h-5 text-muted-foreground" />
    </Button>
  );
}
