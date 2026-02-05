"use client";

import React, { useState } from "react";
import type { GraphNode } from "@/lib/shared/graph-types";
import { NODE_SIZES, ANIMATION_DURATIONS } from "@/lib/shared/graph-types";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  GitCommit,
  Code,
  FileCode,
  TestTube,
} from "lucide-react";

/**
 * Props for GraphNode component
 */
export interface GraphNodeComponentProps {
  node: GraphNode;
  onClick: (node: GraphNode, e: React.MouseEvent) => void;
  onHover?: (node: GraphNode | null, e?: React.MouseEvent) => void;
  isSelected: boolean;
  isUpdated?: boolean;
  compact?: boolean;
}

/**
 * Status icon mapping
 */
const STATUS_ICONS = {
  pending: Clock,
  "in-progress": Loader2,
  complete: CheckCircle2,
  failed: XCircle,
  stuck: AlertCircle,
} as const;

/**
 * Agent type icon mapping
 */
const AGENT_ICONS = {
  test: TestTube,
  backend: Code,
  frontend: FileCode,
  general: Code,
} as const;

/**
 * Status color classes
 */
const STATUS_COLORS = {
  pending: {
    border: "stroke-slate-600",
    fill: "fill-slate-900/40",
    text: "text-slate-400",
    icon: "text-slate-500",
  },
  "in-progress": {
    border: "stroke-blue-500",
    fill: "fill-blue-950/40",
    text: "text-blue-300",
    icon: "text-blue-400",
  },
  complete: {
    border: "stroke-emerald-500",
    fill: "fill-emerald-950/40",
    text: "text-emerald-300",
    icon: "text-emerald-400",
  },
  failed: {
    border: "stroke-red-500",
    fill: "fill-red-950/40",
    text: "text-red-300",
    icon: "text-red-400",
  },
  stuck: {
    border: "stroke-red-600",
    fill: "fill-red-950/60",
    text: "text-red-300",
    icon: "text-red-400",
  },
} as const;

/**
 * Agent type color classes
 */
const AGENT_COLORS = {
  test: "text-purple-400 bg-purple-500/10",
  backend: "text-blue-400 bg-blue-500/10",
  frontend: "text-pink-400 bg-pink-500/10",
  general: "text-slate-400 bg-slate-500/10",
} as const;

/**
 * Graph node component - renders individual nodes in the execution graph
 */
export const GraphNodeComponent = React.memo(function GraphNodeComponent({
  node,
  onClick,
  onHover,
  isSelected,
  isUpdated = false,
  compact = false,
}: GraphNodeComponentProps) {
  const [isHovered, setIsHovered] = useState(false);

  const { type, label, status, x, y, metadata } = node;
  const colors = STATUS_COLORS[status];
  const StatusIcon = STATUS_ICONS[status];

  // Calculate node size (responsive)
  const isMobile = compact;
  const nodeWidth = isMobile
    ? NODE_SIZES[type].mobileWidth
    : NODE_SIZES[type].width;
  const nodeHeight = isMobile
    ? NODE_SIZES[type].mobileHeight
    : NODE_SIZES[type].height;

  // Calculate positions
  const nodeX = x - nodeWidth / 2;
  const nodeY = y - nodeHeight / 2;

  // Format duration
  const formatDuration = (ms: number | undefined): string => {
    if (!ms) return "";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    onClick(node, e);
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // Create synthetic mouse event for consistency
      const syntheticEvent = new MouseEvent(
        "click",
      ) as unknown as React.MouseEvent;
      onClick(node, syntheticEvent);
    }
  };

  // Handle mouse enter
  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);
    onHover?.(node, e);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover?.(null);
  };

  return (
    <g
      className="graph-node"
      transform={`translate(${nodeX}, ${nodeY})`}
      style={{
        transition: `all ${ANIMATION_DURATIONS.statusTransition}ms ease-in-out`,
      }}
    >
      {/* Node background with glow effect */}
      <rect
        x={0}
        y={0}
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        className={`${colors.fill} transition-all duration-300`}
        style={{
          filter:
            isSelected || isHovered
              ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))"
              : "none",
        }}
      >
        {/* Pulse animation for updated nodes */}
        {isUpdated && (
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="500ms"
            repeatCount="1"
          />
        )}
      </rect>

      {/* Pulse ring for updated nodes */}
      {isUpdated && (
        <rect
          x={-2}
          y={-2}
          width={nodeWidth + 4}
          height={nodeHeight + 4}
          rx={10}
          className="fill-none stroke-emerald-400"
          strokeWidth={2}
          opacity={0}
        >
          <animate
            attributeName="opacity"
            values="0;0.8;0"
            dur="500ms"
            repeatCount="1"
          />
          <animate
            attributeName="stroke-width"
            values="2;4;2"
            dur="500ms"
            repeatCount="1"
          />
        </rect>
      )}

      {/* Node border */}
      <rect
        x={0}
        y={0}
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        className={`${colors.border} fill-none transition-all duration-300`}
        strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
      />

      {/* Gradient overlay for in-progress status */}
      {status === "in-progress" && (
        <defs>
          <linearGradient
            id={`gradient-${node.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="rgb(59 130 246 / 0.2)">
              <animate
                attributeName="stop-color"
                values="rgb(59 130 246 / 0.2);rgb(16 185 129 / 0.2);rgb(59 130 246 / 0.2)"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="rgb(16 185 129 / 0.2)">
              <animate
                attributeName="stop-color"
                values="rgb(16 185 129 / 0.2);rgb(59 130 246 / 0.2);rgb(16 185 129 / 0.2)"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="rgb(59 130 246 / 0.2)">
              <animate
                attributeName="stop-color"
                values="rgb(59 130 246 / 0.2);rgb(16 185 129 / 0.2);rgb(59 130 246 / 0.2)"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
      )}

      {status === "in-progress" && (
        <rect
          x={0}
          y={0}
          width={nodeWidth}
          height={nodeHeight}
          rx={8}
          fill={`url(#gradient-${node.id})`}
        />
      )}

      {/* Interactive overlay */}
      <rect
        x={0}
        y={0}
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        className="fill-transparent cursor-pointer"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        aria-label={`${label}, ${status}${metadata.duration ? `, ${formatDuration(metadata.duration)}` : ""}`}
      />

      {/* Content */}
      <foreignObject
        x={12}
        y={12}
        width={nodeWidth - 24}
        height={nodeHeight - 24}
      >
        <div className="flex flex-col h-full justify-between">
          {/* Header */}
          <div className="flex items-start gap-2">
            <StatusIcon
              className={`${colors.icon} flex-shrink-0 ${status === "in-progress" ? "animate-spin" : ""}`}
              size={type === "phase" ? 20 : 16}
            />
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${colors.text} truncate`}>
                {label}
              </div>
              {metadata.agentType && (
                <div className="flex items-center gap-1 mt-1">
                  {React.createElement(AGENT_ICONS[metadata.agentType], {
                    size: 12,
                    className: AGENT_COLORS[metadata.agentType],
                  })}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${AGENT_COLORS[metadata.agentType]}`}
                  >
                    {metadata.agentType}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar (for in-progress nodes) */}
          {status === "in-progress" && metadata.progress !== undefined && (
            <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${metadata.progress}%` }}
              />
            </div>
          )}

          {/* Metadata chips */}
          <div className="flex items-center gap-2 mt-auto flex-wrap">
            {metadata.duration && (
              <span className="font-mono text-xs text-slate-400">
                {formatDuration(metadata.duration)}
              </span>
            )}
            {metadata.commits && metadata.commits.length > 0 && (
              <span className="flex items-center gap-1 font-mono text-xs text-emerald-400">
                <GitCommit size={12} />
                {metadata.commits.length}
              </span>
            )}
            {metadata.filesChanged && metadata.filesChanged.length > 0 && (
              <span className="font-mono text-xs text-slate-400">
                {metadata.filesChanged.length} files
              </span>
            )}
          </div>
        </div>
      </foreignObject>
    </g>
  );
});
