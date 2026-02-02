"use client";

import { cn } from "@/lib/utils";
import { Bot, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Task, TaskStatus } from "@/lib/db/schema";
import { STATUS_CONFIG } from "@/lib/constants/status-config";

// Card-specific visual treatment per status.
// icon and label are derived from the shared STATUS_CONFIG;
// Tailwind color classes are component-specific.
interface CardStatusStyle {
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  isActive?: boolean;
}

const cardStatusStyles: Record<TaskStatus, CardStatusStyle> = {
  todo: {
    color: "text-slate-500 dark:text-slate-400",
    textColor: "text-slate-600 dark:text-slate-300",
    bgColor: "bg-slate-100/80 dark:bg-slate-800/60",
    borderColor: "border-slate-200/80 dark:border-slate-700/60",
    glowColor: "",
  },
  brainstorming: {
    color: "text-violet-500 dark:text-violet-400",
    textColor: "text-violet-600 dark:text-violet-300",
    bgColor: "bg-violet-100/80 dark:bg-violet-900/40",
    borderColor: "border-violet-200/80 dark:border-violet-700/50",
    glowColor: "shadow-violet-500/20",
  },
  planning: {
    color: "text-blue-500 dark:text-blue-400",
    textColor: "text-blue-600 dark:text-blue-300",
    bgColor: "bg-blue-100/80 dark:bg-blue-900/40",
    borderColor: "border-blue-200/80 dark:border-blue-700/50",
    glowColor: "shadow-blue-500/20",
  },
  ready: {
    color: "text-amber-500 dark:text-amber-400",
    textColor: "text-amber-600 dark:text-amber-300",
    bgColor: "bg-amber-100/80 dark:bg-amber-900/40",
    borderColor: "border-amber-200/80 dark:border-amber-700/50",
    glowColor: "",
  },
  executing: {
    color: "text-primary",
    textColor: "text-primary",
    bgColor: "bg-primary/10 dark:bg-primary/20",
    borderColor: "border-primary/30 dark:border-primary/40",
    glowColor: "shadow-primary/25",
    isActive: true,
  },
  review: {
    color: "text-cyan-500 dark:text-cyan-400",
    textColor: "text-cyan-600 dark:text-cyan-300",
    bgColor: "bg-cyan-100/80 dark:bg-cyan-900/40",
    borderColor: "border-cyan-200/80 dark:border-cyan-700/50",
    glowColor: "shadow-cyan-500/20",
  },
  done: {
    color: "text-emerald-500 dark:text-emerald-400",
    textColor: "text-emerald-600 dark:text-emerald-300",
    bgColor: "bg-emerald-100/80 dark:bg-emerald-900/40",
    borderColor: "border-emerald-200/80 dark:border-emerald-700/50",
    glowColor: "",
  },
  stuck: {
    color: "text-red-500 dark:text-red-400",
    textColor: "text-red-600 dark:text-red-300",
    bgColor: "bg-red-100/80 dark:bg-red-900/40",
    borderColor: "border-red-200/80 dark:border-red-700/50",
    glowColor: "shadow-red-500/20",
  },
};

/** Merged config: shared (icon, label) + card-specific (colors). */
export function getCardConfig(status: TaskStatus) {
  const base = STATUS_CONFIG[status];
  const style = cardStatusStyles[status];
  return { icon: base.icon, label: base.label, ...style };
}

/** Progress indicator based on task state. */
export function getProgressPercentage(status: TaskStatus): number {
  const progressMap: Record<TaskStatus, number> = {
    todo: 0,
    brainstorming: 15,
    planning: 30,
    ready: 45,
    executing: 60,
    review: 85,
    done: 100,
    stuck: 0,
  };
  return progressMap[status];
}

// ---------------------------------------------------------------------------
// CardStatusBadge
// ---------------------------------------------------------------------------

interface CardStatusBadgeProps {
  task: Task;
  allTasks?: Task[];
}

/**
 * Renders optional autonomous-mode indicator and dependency/blocker badge
 * for a Kanban card. Status is communicated by the column header.
 */
export function CardStatusBadge({ task, allTasks }: CardStatusBadgeProps) {
  const blockedByIds = (task.blockedByIds as string[]) || [];
  const hasIncompleteBlockers =
    blockedByIds.length > 0 &&
    allTasks?.some((t) => blockedByIds.includes(t.id) && t.status !== "done");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Autonomous mode indicator */}
      {task.autonomousMode && (
        <div
          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100/80 dark:bg-amber-900/40 rounded-full text-xs text-amber-700 dark:text-amber-300 font-medium"
          title="Autonomous mode enabled"
        >
          <Bot className="w-3 h-3" />
          <span>Auto</span>
        </div>
      )}

      {/* Blocked indicator */}
      {blockedByIds.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  hasIncompleteBlockers
                    ? "bg-red-100/80 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                    : "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <Lock className="w-3 h-3" />
                <span>{blockedByIds.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {hasIncompleteBlockers ? (
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    Blocked - cannot drag or execute
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete {blockedByIds.length} blocking task
                    {blockedByIds.length === 1 ? "" : "s"} first
                  </p>
                </div>
              ) : (
                <p>
                  All {blockedByIds.length} blocker
                  {blockedByIds.length === 1 ? "" : "s"} completed
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
