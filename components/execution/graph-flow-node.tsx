"use client";

import React from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNode } from "@/lib/shared/graph-types";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code,
  FileCode,
  Loader2,
  TestTube,
  XCircle,
} from "lucide-react";

/**
 * Data payload passed to each React Flow execution node.
 */
export interface ExecutionFlowNodeData extends Record<string, unknown> {
  graphNode: GraphNode;
  compact: boolean;
  isFocused: boolean;
  isUpdated: boolean;
  onActivate: (
    node: GraphNode,
    e: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onHover?: (node: GraphNode | null, e?: React.MouseEvent) => void;
}

export type ExecutionFlowNode = Node<ExecutionFlowNodeData, "executionNode">;

const STATUS_ICONS = {
  pending: Clock,
  "in-progress": Loader2,
  complete: CheckCircle2,
  failed: XCircle,
  stuck: AlertCircle,
} as const;

const AGENT_ICONS = {
  test: TestTube,
  backend: Code,
  frontend: FileCode,
  general: Code,
} as const;

const STATUS_TONE = {
  pending: {
    ring: "ring-slate-700/70",
    border: "border-slate-700",
    bg: "bg-slate-900/80",
    icon: "text-slate-400",
    text: "text-slate-200",
    chip: "bg-slate-700/40 text-slate-300",
  },
  "in-progress": {
    ring: "ring-blue-500/40",
    border: "border-blue-500/60",
    bg: "bg-blue-950/30",
    icon: "text-blue-300",
    text: "text-blue-100",
    chip: "bg-blue-500/20 text-blue-200",
  },
  complete: {
    ring: "ring-emerald-500/40",
    border: "border-emerald-500/60",
    bg: "bg-emerald-950/30",
    icon: "text-emerald-300",
    text: "text-emerald-100",
    chip: "bg-emerald-500/20 text-emerald-200",
  },
  failed: {
    ring: "ring-red-500/40",
    border: "border-red-500/60",
    bg: "bg-red-950/30",
    icon: "text-red-300",
    text: "text-red-100",
    chip: "bg-red-500/20 text-red-200",
  },
  stuck: {
    ring: "ring-red-600/40",
    border: "border-red-600/60",
    bg: "bg-red-950/40",
    icon: "text-red-300",
    text: "text-red-100",
    chip: "bg-red-600/25 text-red-200",
  },
} as const;

const AGENT_CHIP = {
  test: "bg-purple-500/15 text-purple-200 border-purple-500/30",
  backend: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  frontend: "bg-pink-500/15 text-pink-200 border-pink-500/30",
  general: "bg-slate-500/15 text-slate-200 border-slate-500/30",
} as const;

function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return "";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

export const GraphFlowNode = React.memo(function GraphFlowNode({
  data,
  selected,
}: NodeProps<ExecutionFlowNode>) {
  const node = data.graphNode;
  const tone = STATUS_TONE[node.status];
  const StatusIcon = STATUS_ICONS[node.status];
  const agentType = node.metadata.agentType ?? "general";
  const AgentIcon = AGENT_ICONS[agentType];
  const isActive = selected || data.isFocused;
  const isCompact = data.compact;
  const duration = formatDuration(node.metadata.duration);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      data.onActivate(node, event);
    }
  };

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-xl border px-3 py-2 shadow-xl backdrop-blur-sm transition-all duration-200",
        tone.border,
        tone.bg,
        isActive ? `ring-2 ${tone.ring}` : "ring-1 ring-black/20",
      ].join(" ")}
      style={{ width: node.width, height: node.height }}
      role="button"
      tabIndex={0}
      aria-label={`${node.label}, ${node.status}`}
      onClick={(event) => data.onActivate(node, event)}
      onKeyDown={handleKeyDown}
      onMouseEnter={(event) => data.onHover?.(node, event)}
      onMouseLeave={() => data.onHover?.(null)}
    >
      {data.isUpdated && (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-xl border border-emerald-300/60" />
      )}

      <div className="flex h-full flex-col justify-between gap-2">
        <div className="flex items-start gap-2">
          <StatusIcon
            className={[
              "mt-0.5 shrink-0",
              tone.icon,
              node.status === "in-progress" ? "animate-spin" : "",
              isCompact ? "h-3.5 w-3.5" : "h-4 w-4",
            ].join(" ")}
          />

          <div className="min-w-0 flex-1">
            <div
              className={[
                "truncate font-medium leading-tight",
                tone.text,
                isCompact ? "text-[11px]" : "text-xs",
              ].join(" ")}
            >
              {node.label}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span
                className={[
                  "inline-flex rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                  tone.chip,
                ].join(" ")}
              >
                {node.status}
              </span>
              <span className="text-[10px] text-slate-400">{node.type}</span>
            </div>
          </div>
        </div>

        {node.status === "in-progress" &&
          typeof node.metadata.progress === "number" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Progress</span>
                <span>{node.metadata.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800/80">
                <div
                  className="h-1.5 rounded-full bg-blue-400 transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, node.metadata.progress))}%`,
                  }}
                />
              </div>
            </div>
          )}

        <div className="flex items-center justify-between gap-2">
          <span
            className={[
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
              AGENT_CHIP[agentType],
            ].join(" ")}
          >
            <AgentIcon className="h-3 w-3" />
            {agentType}
          </span>

          {duration ? (
            <span className="text-[10px] text-slate-300">{duration}</span>
          ) : (
            <span className="text-[10px] text-slate-500">-</span>
          )}
        </div>
      </div>
    </div>
  );
});
