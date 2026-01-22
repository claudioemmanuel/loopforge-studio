"use client";

import * as React from "react";
import {
  Lightbulb,
  FileText,
  CheckCircle,
  Play,
  Flag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Stage types matching the autonomous flow
export type TimelineStage =
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "done";

export type StageStatus = "completed" | "current" | "pending";

export interface TimelineStageData {
  stage: TimelineStage;
  status: StageStatus;
  timestamp?: Date;
  duration?: number; // in seconds
  summary?: string;
  details?: string[];
  currentAction?: string; // e.g., "Step 3/6: Creating auth middleware"
  progress?: number; // 0-100 for executing stage
}

interface WorkerTimelineProps {
  stages: TimelineStageData[];
  className?: string;
  compact?: boolean;
}

/**
 * Stage configuration with icons and labels
 */
const stageConfig: Record<
  TimelineStage,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  brainstorming: { label: "Brainstorming", icon: Lightbulb },
  planning: { label: "Planning", icon: FileText },
  ready: { label: "Ready", icon: CheckCircle },
  executing: { label: "Executing", icon: Play },
  done: { label: "Done", icon: Flag },
};

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Single timeline node component
 */
function TimelineNode({
  stage,
  isLast,
  compact,
  defaultExpanded = false,
}: {
  stage: TimelineStageData;
  isLast: boolean;
  compact?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(
    defaultExpanded || stage.status === "current"
  );
  const config = stageConfig[stage.stage];
  const Icon = config.icon;

  const hasDetails =
    stage.details && stage.details.length > 0 && stage.status === "completed";
  const showExpandToggle = hasDetails && !compact;

  return (
    <div className="relative flex gap-3">
      {/* Vertical line connector */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[11px] top-8 w-0.5 -bottom-2",
            stage.status === "completed"
              ? "bg-primary"
              : stage.status === "current"
                ? "bg-gradient-to-b from-primary to-border"
                : "bg-border"
          )}
        />
      )}

      {/* Node indicator */}
      <div className="relative z-10 shrink-0">
        {stage.status === "completed" && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
          </div>
        )}
        {stage.status === "current" && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-pulse">
            <div className="w-3 h-3 rounded-full bg-primary-foreground" />
          </div>
        )}
        {stage.status === "pending" && (
          <div className="w-6 h-6 rounded-full border-2 border-border bg-background" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {showExpandToggle ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "font-medium text-sm",
                    stage.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {config.label}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "w-4 h-4",
                    stage.status === "completed" && "text-primary",
                    stage.status === "current" && "text-primary",
                    stage.status === "pending" && "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "font-medium text-sm",
                    stage.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {config.label}
                </span>
              </div>
            )}

            {/* Status badge */}
            {stage.status === "completed" && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Completed
              </span>
            )}
            {stage.status === "current" && (
              <span className="text-xs text-primary font-medium animate-pulse">
                In progress...
              </span>
            )}
            {stage.status === "pending" && (
              <span className="text-xs text-muted-foreground">Pending</span>
            )}
          </div>

          {/* Timestamp and duration */}
          {stage.timestamp && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatTimestamp(stage.timestamp)}</span>
              {stage.duration !== undefined && stage.status === "completed" && (
                <span className="text-muted-foreground/60">
                  {formatDuration(stage.duration)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Summary line */}
        {stage.summary && !compact && (
          <p
            className={cn(
              "text-xs text-muted-foreground mt-1",
              showExpandToggle && "ml-6"
            )}
          >
            {stage.summary}
          </p>
        )}

        {/* Current action for executing stage */}
        {stage.status === "current" && stage.currentAction && (
          <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-foreground">{stage.currentAction}</p>
            {stage.progress !== undefined && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${stage.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Expanded details */}
        {hasDetails && expanded && !compact && (
          <ul className="mt-2 ml-6 space-y-1">
            {stage.details!.map((detail, idx) => (
              <li
                key={idx}
                className="text-xs text-muted-foreground flex items-start gap-2"
              >
                <span className="text-muted-foreground/50 mt-0.5">-</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Worker Timeline Component
 *
 * A vertical timeline showing task progression through stages:
 * brainstorming -> planning -> ready -> executing -> done
 *
 * Each node displays:
 * - Stage name and status
 * - Timestamp and duration
 * - Summary information
 * - Expandable details for completed stages
 * - Live progress for current stage
 */
export function WorkerTimeline({
  stages,
  className,
  compact = false,
}: WorkerTimelineProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {stages.map((stage, index) => (
        <TimelineNode
          key={stage.stage}
          stage={stage}
          isLast={index === stages.length - 1}
          compact={compact}
          defaultExpanded={stages.length <= 3}
        />
      ))}
    </div>
  );
}

/**
 * Create a default timeline with all stages
 * Useful for initializing the timeline with proper stage order
 */
export function createDefaultTimeline(
  currentStage: TimelineStage,
  stageData?: Partial<Record<TimelineStage, Partial<TimelineStageData>>>
): TimelineStageData[] {
  const allStages: TimelineStage[] = [
    "brainstorming",
    "planning",
    "ready",
    "executing",
    "done",
  ];

  const currentIndex = allStages.indexOf(currentStage);

  return allStages.map((stage, index) => {
    const customData = stageData?.[stage] || {};
    let status: StageStatus;

    if (index < currentIndex) {
      status = "completed";
    } else if (index === currentIndex) {
      status = "current";
    } else {
      status = "pending";
    }

    return {
      stage,
      status,
      ...customData,
    };
  });
}

/**
 * Compact timeline variant for use in cards/notifications
 */
export function CompactTimeline({
  currentStage,
  progress,
  className,
}: {
  currentStage: TimelineStage;
  progress?: number;
  className?: string;
}) {
  const allStages: TimelineStage[] = [
    "brainstorming",
    "planning",
    "ready",
    "executing",
    "done",
  ];
  const currentIndex = allStages.indexOf(currentStage);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {allStages.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const config = stageConfig[stage];

        return (
          <React.Fragment key={stage}>
            {/* Node */}
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                isCompleted && "bg-primary",
                isCurrent && "bg-primary animate-pulse",
                !isCompleted && !isCurrent && "bg-border"
              )}
              title={config.label}
            />
            {/* Connector line */}
            {index < allStages.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 min-w-[8px] max-w-[16px]",
                  index < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
      {/* Progress percentage */}
      {progress !== undefined && (
        <span className="ml-2 text-xs text-muted-foreground">{progress}%</span>
      )}
    </div>
  );
}
