"use client";

import React from "react";
import * as Popover from "@radix-ui/react-popover";
import type { GraphNode } from "@/lib/shared/graph-types";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  GitCommit,
  FileText,
  Calendar,
  Timer,
  TrendingUp,
  Link2,
} from "lucide-react";

/**
 * Props for GraphTooltip component
 */
export interface GraphTooltipProps {
  node: GraphNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Status icons
 */
const STATUS_ICONS = {
  pending: Clock,
  "in-progress": Loader2,
  complete: CheckCircle2,
  failed: XCircle,
  stuck: AlertCircle,
} as const;

/**
 * Status colors
 */
const STATUS_COLORS = {
  pending: "text-slate-400 bg-slate-500/10",
  "in-progress": "text-blue-400 bg-blue-500/10",
  complete: "text-emerald-400 bg-emerald-500/10",
  failed: "text-red-400 bg-red-500/10",
  stuck: "text-red-400 bg-red-600/10",
} as const;

/**
 * Format timestamp
 */
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return "—";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format duration
 */
function formatDuration(ms: number | undefined): string {
  if (!ms) return "—";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Graph tooltip component - shows detailed information about a node
 */
export function GraphTooltip({
  node,
  open,
  onOpenChange,
  children,
}: GraphTooltipProps) {
  if (!node) return <>{children}</>;

  const StatusIcon = STATUS_ICONS[node.status];
  const statusColor = STATUS_COLORS[node.status];

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-lg border border-slate-700 bg-slate-800 shadow-xl animate-in fade-in-0 zoom-in-95"
          sideOffset={8}
          collisionPadding={16}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded ${statusColor}`}>
                <StatusIcon
                  className={`w-5 h-5 ${node.status === "in-progress" ? "animate-spin" : ""}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-200 truncate">
                  {node.label}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}
                  >
                    {node.status}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">
                    {node.type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-3 space-y-3 max-h-[400px] overflow-y-auto">
            {/* Timing Information */}
            {(node.metadata.startedAt ||
              node.metadata.completedAt ||
              node.metadata.duration) && (
              <div className="space-y-2">
                {node.metadata.startedAt && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500">Started:</span>
                    <span className="text-slate-300 font-mono">
                      {formatTimestamp(node.metadata.startedAt)}
                    </span>
                  </div>
                )}

                {node.metadata.completedAt && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500">Completed:</span>
                    <span className="text-slate-300 font-mono">
                      {formatTimestamp(node.metadata.completedAt)}
                    </span>
                  </div>
                )}

                {node.metadata.duration && (
                  <div className="flex items-center gap-2 text-xs">
                    <Timer className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500">Duration:</span>
                    <span className="text-slate-300 font-mono">
                      {formatDuration(node.metadata.duration)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {node.status === "in-progress" &&
              node.metadata.progress !== undefined && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-slate-300 font-mono">
                      {node.metadata.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${node.metadata.progress}%` }}
                    />
                  </div>
                </div>
              )}

            {/* Commits */}
            {node.metadata.commits && node.metadata.commits.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Commits ({node.metadata.commits.length})</span>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {node.metadata.commits.map((commit, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-xs bg-slate-700/30 rounded p-2"
                    >
                      <GitCommit className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-slate-400 text-[10px]">
                          {commit.sha.slice(0, 7)}
                        </div>
                        {commit.message && (
                          <div className="text-slate-300 line-clamp-2 mt-0.5">
                            {commit.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Changed */}
            {node.metadata.filesChanged &&
              node.metadata.filesChanged.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>
                      Files Changed ({node.metadata.filesChanged.length})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {node.metadata.filesChanged
                      .slice(0, 10)
                      .map((file, index) => (
                        <div
                          key={index}
                          className="text-xs font-mono text-slate-300 bg-slate-700/30 rounded px-2 py-1 truncate"
                          title={file}
                        >
                          {file}
                        </div>
                      ))}
                    {node.metadata.filesChanged.length > 10 && (
                      <div className="text-xs text-slate-500 italic px-2">
                        +{node.metadata.filesChanged.length - 10} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Iteration */}
            {node.metadata.iteration !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500">Iteration:</span>
                <span className="text-slate-300 font-mono">
                  {node.metadata.iteration + 1}
                </span>
              </div>
            )}

            {/* Error Message */}
            {node.metadata.errorMessage && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Error</span>
                </div>
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2 font-mono whitespace-pre-wrap break-words">
                  {node.metadata.errorMessage}
                </div>
              </div>
            )}

            {/* Agent Type Badge */}
            {node.metadata.agentType && (
              <div className="flex items-center gap-2 text-xs">
                <Link2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500">Agent Type:</span>
                <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 capitalize">
                  {node.metadata.agentType}
                </span>
              </div>
            )}
          </div>

          <Popover.Arrow className="fill-slate-700" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
