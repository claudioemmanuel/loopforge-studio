"use client";

import React, { useEffect, useState } from "react";
import type { GraphNode } from "@/lib/execution/graph-types";
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
} from "lucide-react";

/**
 * Props for GraphNodeTooltip component
 */
export interface GraphNodeTooltipProps {
  node: GraphNode | null;
  mouseX: number;
  mouseY: number;
  containerRef: React.RefObject<HTMLElement>;
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
 * Format timestamp
 */
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return "—";

  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
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
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Simple tooltip component for graph nodes
 * Appears on hover with node details
 */
export function GraphNodeTooltip({
  node,
  mouseX,
  mouseY,
  containerRef,
}: GraphNodeTooltipProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!node || !containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 400; // max height
    const offset = 12;

    // Calculate position relative to container
    let x = mouseX - container.left + offset;
    let y = mouseY - container.top + offset;

    // Keep tooltip within bounds
    if (x + tooltipWidth > container.width) {
      x = mouseX - container.left - tooltipWidth - offset;
    }
    if (y + tooltipHeight > container.height) {
      y = container.height - tooltipHeight - 20;
    }

    setPosition({ x, y });
  }, [node, mouseX, mouseY, containerRef]);

  if (!node) return null;

  const StatusIcon = STATUS_ICONS[node.status];

  return (
    <div
      className="absolute z-50 w-80 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-slate-700/50">
              <StatusIcon
                className={`w-5 h-5 ${node.status === "in-progress" ? "animate-spin text-blue-400" : "text-slate-400"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-slate-200 truncate">
                {node.label}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300 capitalize">
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
        <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
          {/* Timing */}
          {node.metadata.startedAt && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Started:</span>
              <span className="text-slate-300">
                {formatTimestamp(node.metadata.startedAt)}
              </span>
            </div>
          )}

          {node.metadata.duration && (
            <div className="flex items-center gap-2 text-xs">
              <Timer className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Duration:</span>
              <span className="text-slate-300">
                {formatDuration(node.metadata.duration)}
              </span>
            </div>
          )}

          {/* Progress */}
          {node.status === "in-progress" &&
            node.metadata.progress !== undefined && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Progress</span>
                  <span className="text-slate-300">
                    {node.metadata.progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
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
              <div className="space-y-1.5">
                {node.metadata.commits.slice(0, 3).map((commit, index) => (
                  <div
                    key={index}
                    className="text-xs bg-slate-700/30 rounded p-2"
                  >
                    <div className="font-mono text-slate-400 text-[10px]">
                      {commit.sha.slice(0, 7)}
                    </div>
                  </div>
                ))}
                {node.metadata.commits.length > 3 && (
                  <div className="text-xs text-slate-500 italic">
                    +{node.metadata.commits.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Files */}
          {node.metadata.filesChanged &&
            node.metadata.filesChanged.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Files changed:</span>
                <span className="text-slate-300">
                  {node.metadata.filesChanged.length}
                </span>
              </div>
            )}

          {/* Error */}
          {node.metadata.errorMessage && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-red-400">
                <XCircle className="w-3.5 h-3.5" />
                <span>Error</span>
              </div>
              <div className="text-xs text-red-300 bg-red-500/10 rounded p-2 font-mono max-h-20 overflow-y-auto">
                {node.metadata.errorMessage}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
