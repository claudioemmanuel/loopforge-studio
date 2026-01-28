"use client";

import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  GitCommit,
  FileText,
  Coins,
} from "lucide-react";
import { EventCard } from "./event-card";
import type { ActivityEvent, ActivitySummary } from "@/lib/db/schema";

interface DailySummaryProps {
  date: Date;
  summary?: ActivitySummary;
  events: ActivityEvent[];
  defaultExpanded?: boolean;
  onTaskClick?: (taskId: string) => void;
  onRepoClick?: (repoId: string) => void;
}

function formatDateHeader(date: Date): string {
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "EEEE, MMMM d");
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function DailySummary({
  date,
  summary,
  events,
  defaultExpanded = false,
  onTaskClick,
  onRepoClick,
}: DailySummaryProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate stats from events if no summary provided
  const stats = summary ?? {
    tasksCompleted: events.filter((e) => e.eventType === "task_completed")
      .length,
    tasksFailed: events.filter((e) => e.eventType === "task_failed").length,
    commits: events.filter((e) => e.eventType === "commit").length,
    filesChanged: new Set(
      events
        .filter((e) => e.metadata?.filePath)
        .map((e) => e.metadata?.filePath),
    ).size,
    tokensUsed: 0,
  };

  const hasEvents = events.length > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          "hover:bg-muted/50",
          isExpanded && "border-b bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
          <div>
            <h3 className="font-semibold text-sm">{formatDateHeader(date)}</h3>
            <p className="text-xs text-muted-foreground">
              {format(date, "MMM d, yyyy")} &middot; {events.length} event
              {events.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-4">
          {/* Tasks Completed */}
          {(stats.tasksCompleted ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">
                {stats.tasksCompleted}
              </span>
            </div>
          )}

          {/* Tasks Failed */}
          {(stats.tasksFailed ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{stats.tasksFailed}</span>
            </div>
          )}

          {/* Commits */}
          {(stats.commits ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
              <GitCommit className="w-4 h-4" />
              <span className="text-sm font-medium">{stats.commits}</span>
            </div>
          )}

          {/* Files Changed */}
          {(stats.filesChanged ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">{stats.filesChanged}</span>
            </div>
          )}

          {/* Tokens Used (if available) */}
          {(stats.tokensUsed ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Coins className="w-4 h-4" />
              <span className="text-sm font-medium">
                {formatNumber(stats.tokensUsed ?? 0)}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Events List */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {hasEvents ? (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onTaskClick={onTaskClick}
                onRepoClick={onRepoClick}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No activity recorded for this day
            </div>
          )}
        </div>
      )}

      {/* Summary Text (if provided and expanded) */}
      {isExpanded && summary?.summaryText && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-sm text-muted-foreground italic">
              {summary.summaryText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
