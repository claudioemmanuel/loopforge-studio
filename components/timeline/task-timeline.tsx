"use client";

import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Zap,
  User,
  Bot,
  Clock,
  Lightbulb,
  FileText,
  Play,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { StatusHistoryEntry, TaskStatus } from "@/lib/db/schema";

interface TaskTimelineProps {
  history: StatusHistoryEntry[];
  compact?: boolean; // true for modal, false for page
}

// Status configuration for timeline display
const statusConfig: Record<
  TaskStatus,
  {
    icon: typeof Clock;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  todo: {
    icon: Clock,
    label: "To Do",
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
  brainstorming: {
    icon: Lightbulb,
    label: "Brainstorming",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/40",
  },
  planning: {
    icon: FileText,
    label: "Planning",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
  },
  ready: {
    icon: Zap,
    label: "Ready",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/40",
  },
  executing: {
    icon: Play,
    label: "Executing",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  done: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  stuck: {
    icon: AlertTriangle,
    label: "Failed",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/40",
  },
};

// Get icon based on triggeredBy
function getTriggerIcon(triggeredBy: StatusHistoryEntry["triggeredBy"]) {
  switch (triggeredBy) {
    case "autonomous":
      return Zap;
    case "worker":
      return Bot;
    case "user":
    default:
      return User;
  }
}

// Get trigger label
function getTriggerLabel(triggeredBy: StatusHistoryEntry["triggeredBy"]) {
  switch (triggeredBy) {
    case "autonomous":
      return "Autonomous";
    case "worker":
      return "Worker";
    case "user":
    default:
      return "User";
  }
}

export function TaskTimeline({ history, compact = false }: TaskTimelineProps) {
  // Sort by timestamp (newest first)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sortedHistory.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-12"
      )}>
        <Clock className="w-8 h-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No status changes yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Timeline will appear when the task status changes
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", compact ? "" : "")}>
      {sortedHistory.map((entry, index) => {
        const toConfig = statusConfig[entry.to];
        const fromConfig = entry.from ? statusConfig[entry.from] : null;
        const ToIcon = toConfig.icon;
        const TriggerIcon = getTriggerIcon(entry.triggeredBy);
        const timestamp = new Date(entry.timestamp);
        const isLast = index === sortedHistory.length - 1;

        return (
          <div
            key={`${entry.timestamp}-${entry.to}`}
            className={cn(
              "relative flex gap-4",
              compact ? "pb-4" : "pb-6"
            )}
          >
            {/* Timeline connector line */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-0.5 bg-border",
                  compact ? "-bottom-2" : "-bottom-3"
                )}
              />
            )}

            {/* Status icon */}
            <div
              className={cn(
                "relative z-10 flex items-center justify-center flex-shrink-0 rounded-full",
                compact ? "w-8 h-8" : "w-8 h-8",
                toConfig.bgColor
              )}
            >
              <ToIcon className={cn("w-4 h-4", toConfig.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Status change description */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      Moved to{" "}
                      <span className={toConfig.color}>{toConfig.label}</span>
                    </span>
                    {fromConfig && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>from</span>
                        <span className={fromConfig.color}>
                          {fromConfig.label}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Trigger info */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TriggerIcon className="w-3 h-3" />
                      <span>{getTriggerLabel(entry.triggeredBy)}</span>
                    </div>
                    <span className="text-muted-foreground/40">·</span>
                    <span
                      className="text-xs text-muted-foreground"
                      title={format(timestamp, "PPpp")}
                    >
                      {formatDistanceToNow(timestamp, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Arrow indicator for direction */}
                {!compact && (
                  <div className="flex-shrink-0 pt-0.5">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
