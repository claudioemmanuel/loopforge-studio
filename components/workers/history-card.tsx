"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Lightbulb,
  Play,
  Terminal,
  BookOpen,
  Edit3,
  Brain,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WorkerJobPhase } from "@/lib/db/schema";

// Event icons mapping
const eventIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  thinking: Brain,
  action: Zap,
  file_read: BookOpen,
  file_write: Edit3,
  api_call: Terminal,
  error: AlertTriangle,
  complete: CheckCircle2,
};

// Event colors - using app's muted palette
const eventColors: Record<string, string> = {
  thinking: "text-muted-foreground",
  action: "text-primary",
  file_read: "text-muted-foreground",
  file_write: "text-primary",
  api_call: "text-muted-foreground",
  error: "text-destructive",
  complete: "text-primary",
};

// Phase badge configuration - using app's muted palette
const phaseBadgeConfig: Record<
  WorkerJobPhase,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    textColor: string;
  }
> = {
  brainstorming: {
    label: "Brainstorm",
    icon: Lightbulb,
    bgColor: "bg-secondary",
    textColor: "text-secondary-foreground",
  },
  planning: {
    label: "Planning",
    icon: FileText,
    bgColor: "bg-secondary",
    textColor: "text-secondary-foreground",
  },
  executing: {
    label: "Execution",
    icon: Play,
    bgColor: "bg-primary/10",
    textColor: "text-primary",
  },
};

export interface HistoryItemData {
  id: string;
  taskId: string;
  taskTitle: string;
  repoId: string;
  repoName: string;
  phase: WorkerJobPhase;
  status: "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in seconds
  resultSummary?: string;
  error?: string;
  // For expanded view - recent worker events
  events?: Array<{
    id: string;
    eventType: string;
    content: string;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

interface HistoryCardProps {
  item: HistoryItemData;
  defaultExpanded?: boolean;
  onRetry?: (taskId: string) => void;
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
 * Format duration in human-readable form
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format event content for display
 */
function formatEventContent(event: {
  eventType: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const metadata = event.metadata;

  switch (event.eventType) {
    case "file_read":
      return `Read ${metadata?.filePath || event.content}`;
    case "file_write":
      return `Modified ${metadata?.filePath || event.content}`;
    case "action":
      return event.content.length > 60
        ? event.content.slice(0, 60) + "..."
        : event.content;
    case "api_call":
      return `API call: ${event.content}`;
    case "thinking":
      return event.content.length > 60
        ? event.content.slice(0, 60) + "..."
        : event.content;
    default:
      return event.content.length > 60
        ? event.content.slice(0, 60) + "..."
        : event.content;
  }
}

/**
 * Status badge configuration - using app's muted palette
 */
const statusConfig = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    bgColor: "bg-primary/10",
    textColor: "text-primary",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    bgColor: "bg-destructive/10",
    textColor: "text-destructive",
  },
};

/**
 * History Card Component
 *
 * Shows worker job history with:
 * - Collapsed: title, phase badge, status badge, timestamp, result summary
 * - Expanded: full details, events, actions
 */
export const HistoryCard = React.memo(function HistoryCard({
  item,
  defaultExpanded = false,
  onRetry,
  className,
}: HistoryCardProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const statusCfg = statusConfig[item.status];
  const StatusIcon = statusCfg.icon;
  const phaseCfg = phaseBadgeConfig[item.phase];
  const PhaseIcon = phaseCfg.icon;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        item.status === "failed" && "border-destructive/30",
        className,
      )}
    >
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-start gap-3 p-4 text-left",
          "hover:bg-muted/30 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
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
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="font-medium text-sm truncate">
                {item.taskTitle}
              </span>
              {/* Phase badge */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
                  phaseCfg.bgColor,
                  phaseCfg.textColor,
                )}
              >
                <PhaseIcon className="w-2.5 h-2.5" />
                {phaseCfg.label}
              </span>
              {/* Status badge */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
                  statusCfg.bgColor,
                  statusCfg.textColor,
                )}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                {statusCfg.label}
              </span>
            </div>

            {/* Time indicator */}
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(item.completedAt || item.startedAt)}
            </span>
          </div>

          {/* Repository */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="w-3 h-3" />
            <span className="truncate">{item.repoName}</span>
          </div>

          {/* Result summary and duration - only when collapsed */}
          {!expanded && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {item.duration !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(item.duration)}
                </span>
              )}
              {item.resultSummary && (
                <span className="text-foreground/70">{item.resultSummary}</span>
              )}
            </div>
          )}

          {/* Error message preview for failed - only when collapsed */}
          {!expanded && item.error && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <span className="text-destructive line-clamp-1">
                {item.error}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50">
          <div className="px-4 py-4 space-y-4">
            {/* Job summary - flat row with dividers */}
            <div className="flex divide-x divide-border">
              <div className="flex-1 pr-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">
                  Phase
                </p>
                <p className="text-sm font-medium capitalize">{item.phase}</p>
              </div>
              <div className="flex-1 px-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">
                  Duration
                </p>
                <p className="text-sm font-medium">
                  {item.duration ? formatDuration(item.duration) : "-"}
                </p>
              </div>
              <div className="flex-1 pl-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">
                  Result
                </p>
                <p className="text-sm font-medium">
                  {item.resultSummary || "-"}
                </p>
              </div>
            </div>

            {/* Activity Log - timeline style */}
            {item.events && item.events.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Activity Log ({item.events.length} events)
                </p>
                <div className="border-l border-border ml-1 pl-4 space-y-2">
                  {item.events.slice(0, 8).map((event) => {
                    const EventIcon = eventIcons[event.eventType] || Brain;
                    const colorClass =
                      eventColors[event.eventType] || "text-muted-foreground";
                    const displayContent = formatEventContent(event);

                    return (
                      <div
                        key={event.id}
                        className="relative flex items-start gap-2.5"
                      >
                        <div className="absolute -left-[18px] top-1.5 w-1.5 h-1.5 rounded-full bg-border" />
                        <EventIcon
                          className={cn("w-4 h-4 shrink-0 mt-0.5", colorClass)}
                        />
                        <span className="text-sm text-foreground/80">
                          {displayContent}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {item.events.length > 8 && (
                  <p className="text-xs text-muted-foreground mt-2 ml-6">
                    +{item.events.length - 8} more events
                  </p>
                )}
              </div>
            )}

            {/* Error message for failed */}
            {item.error && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">
                    Job failed
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">
                    {item.error}
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {item.status === "failed" && onRetry && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(item.taskId);
                  }}
                >
                  Retry
                </Button>
              )}

              <Link href={`/workers/${item.taskId}`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  View Execution Details
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
});

/**
 * Loading skeleton for HistoryCard
 */
export function HistoryCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 bg-muted rounded w-48 animate-pulse" />
              <div className="h-4 bg-muted rounded w-20 animate-pulse" />
              <div className="h-4 bg-muted rounded w-16 animate-pulse" />
            </div>
            <div className="h-3 bg-muted rounded w-32 animate-pulse" />
            <div className="flex gap-3">
              <div className="h-3 bg-muted rounded w-16 animate-pulse" />
              <div className="h-3 bg-muted rounded w-24 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
