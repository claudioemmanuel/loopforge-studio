"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Box,
  FileCode,
  Code,
  TestTube,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/**
 * Props for GraphLegend component
 */
export interface GraphLegendProps {
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * Legend items configuration
 */
const STATUS_ITEMS: Array<{
  icon: typeof Clock;
  label: string;
  color: string;
  bgColor: string;
  animated?: boolean;
}> = [
  {
    icon: Clock,
    label: "Pending",
    color: "text-slate-400",
    bgColor: "bg-slate-600/20",
  },
  {
    icon: Loader2,
    label: "In Progress",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    animated: true,
  },
  {
    icon: CheckCircle2,
    label: "Complete",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  {
    icon: XCircle,
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  {
    icon: AlertCircle,
    label: "Stuck",
    color: "text-red-400",
    bgColor: "bg-red-600/20",
  },
];

const NODE_TYPE_ITEMS = [
  {
    icon: Box,
    label: "Phase",
    description: "Execution phase",
  },
  {
    icon: FileCode,
    label: "Sub-task",
    description: "Individual task",
  },
  {
    icon: Code,
    label: "Agent",
    description: "AI agent",
  },
] as const;

const AGENT_TYPE_ITEMS = [
  {
    icon: TestTube,
    label: "Test",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Code,
    label: "Backend",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: FileCode,
    label: "Frontend",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: Code,
    label: "General",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
  },
] as const;

/**
 * Graph legend component - displays color-coded status and type indicators
 */
export function GraphLegend({
  className = "",
  defaultExpanded = true,
}: GraphLegendProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse legend" : "Expand legend"}
      >
        <span className="text-xs text-slate-400 font-medium">Legend</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Status Section */}
          <div>
            <div className="text-xs text-slate-500 font-medium mb-2">
              Status
            </div>
            <div className="space-y-1.5">
              {STATUS_ITEMS.map(
                ({ icon: Icon, label, color, bgColor, animated }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-xs text-slate-300"
                  >
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded ${bgColor}`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 ${color} ${animated ? "animate-spin" : ""}`}
                      />
                    </div>
                    <span>{label}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-700" />

          {/* Node Types Section */}
          <div>
            <div className="text-xs text-slate-500 font-medium mb-2">
              Node Types
            </div>
            <div className="space-y-1.5">
              {NODE_TYPE_ITEMS.map(({ icon: Icon, label, description }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-xs text-slate-300"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-700/50">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div>{label}</div>
                    <div className="text-[10px] text-slate-500">
                      {description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-700" />

          {/* Agent Types Section */}
          <div>
            <div className="text-xs text-slate-500 font-medium mb-2">
              Agent Types
            </div>
            <div className="space-y-1.5">
              {AGENT_TYPE_ITEMS.map(({ icon: Icon, label, color, bgColor }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-xs text-slate-300"
                >
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded ${bgColor}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
