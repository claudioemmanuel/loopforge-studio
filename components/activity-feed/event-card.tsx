"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  FileText,
  Edit3,
  Terminal,
  GitCommit,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { ActivityEvent, ActivityEventCategory } from "@/lib/db/schema";

interface EventCardProps {
  event: ActivityEvent;
  onTaskClick?: (taskId: string) => void;
  onRepoClick?: (repoId: string) => void;
}

// Icon mapping for event types
const eventIcons: Record<string, typeof Brain> = {
  // AI Actions
  thinking: Brain,
  file_read: FileText,
  file_write: Edit3,
  api_call: Zap,
  // Git Operations
  commit: GitCommit,
  branch_create: GitBranch,
  branch_checkout: GitBranch,
  pr_create: ExternalLink,
  repo_clone: Terminal,
  repo_update: Terminal,
  // System Events
  task_started: Clock,
  task_completed: CheckCircle,
  task_failed: AlertCircle,
  error: AlertCircle,
  complete: CheckCircle,
  stuck: AlertCircle,
};

// Color mapping for event categories
const categoryColors: Record<
  ActivityEventCategory,
  { border: string; bg: string; text: string }
> = {
  ai_action: {
    border: "border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
  },
  git: {
    border: "border-l-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-300",
  },
  system: {
    border: "border-l-slate-500",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    text: "text-slate-700 dark:text-slate-300",
  },
};

// Additional color hints for specific event types
const eventTypeColors: Record<string, { border: string }> = {
  error: { border: "border-l-red-500" },
  task_failed: { border: "border-l-red-500" },
  stuck: { border: "border-l-orange-500" },
  complete: { border: "border-l-emerald-500" },
  task_completed: { border: "border-l-emerald-500" },
  commit: { border: "border-l-violet-500" },
};

function formatEventType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EventCard({ event, onTaskClick, onRepoClick }: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryStyle = categoryColors[event.eventCategory];
  const eventTypeStyle = eventTypeColors[event.eventType];
  const Icon = eventIcons[event.eventType] || Clock;

  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
  const hasContent = event.content && event.content.trim().length > 0;
  const isExpandable =
    hasMetadata || (hasContent && (event.content?.length ?? 0) > 100);

  return (
    <div
      className={cn(
        "relative p-3 rounded-lg border-l-4 transition-colors",
        eventTypeStyle?.border || categoryStyle.border,
        isExpanded ? categoryStyle.bg : "bg-card hover:bg-muted/50",
        isExpandable && "cursor-pointer",
      )}
      onClick={() => isExpandable && setIsExpanded(!isExpanded)}
    >
      {/* Header Row */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            categoryStyle.bg,
          )}
        >
          <Icon className={cn("w-4 h-4", categoryStyle.text)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">{event.title}</h4>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-medium",
                categoryStyle.bg,
                categoryStyle.text,
              )}
            >
              {formatEventType(event.eventType)}
            </span>
          </div>

          {/* Preview content (truncated) */}
          {hasContent && !isExpanded && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {event.content}
            </p>
          )}

          {/* Expanded content */}
          {isExpanded && hasContent && (
            <div className="mt-2 p-2 rounded bg-background/50 border">
              <pre className="text-xs whitespace-pre-wrap font-mono overflow-x-auto">
                {event.content}
              </pre>
            </div>
          )}

          {/* Expanded metadata */}
          {isExpanded && hasMetadata && (
            <div className="mt-2 space-y-1">
              {event.metadata?.filePath && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">File:</span>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono">
                    {event.metadata.filePath}
                  </code>
                </div>
              )}
              {event.metadata?.commitSha && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Commit:</span>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono">
                    {event.metadata.commitSha.slice(0, 7)}
                  </code>
                </div>
              )}
              {event.metadata?.branchName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Branch:</span>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono">
                    {event.metadata.branchName}
                  </code>
                </div>
              )}
              {event.metadata?.command && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Command:</span>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono">
                    {event.metadata.command}
                  </code>
                </div>
              )}
              {event.metadata?.prNumber && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">PR:</span>
                  <span className="font-medium">
                    #{event.metadata.prNumber}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(event.createdAt), {
                addSuffix: true,
              })}
            </span>
            {event.taskId && onTaskClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick(event.taskId!);
                }}
                className="text-primary hover:underline"
              >
                View Task
              </button>
            )}
            {event.repoId && onRepoClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRepoClick(event.repoId!);
                }}
                className="text-primary hover:underline"
              >
                View Repo
              </button>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        {isExpandable && (
          <div className="flex-shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
