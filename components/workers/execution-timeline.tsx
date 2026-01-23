"use client";

import * as React from "react";
import {
  Lightbulb,
  FileText,
  CheckCircle,
  Play,
  Flag,
  BookOpen,
  Edit3,
  Terminal,
  GitCommit,
  AlertCircle,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionEvent as DbExecutionEvent, Task, Execution } from "@/lib/db/schema";
import type { ExecutionEventMetadata } from "@/lib/ralph/types";

// Phase configuration
type Phase = "brainstorming" | "planning" | "ready" | "executing" | "done";
type PhaseStatus = "completed" | "current" | "pending";

interface PhaseData {
  phase: Phase;
  status: PhaseStatus;
  startedAt?: Date;
  duration?: number; // in seconds
}

// Event icons mapping
const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  thinking: Brain,
  file_read: BookOpen,
  file_write: Edit3,
  command_run: Terminal,
  commit: GitCommit,
  error: AlertCircle,
  complete: CheckCircle,
  stuck: AlertCircle,
};

// Phase config
const phaseConfig: Record<Phase, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  brainstorming: { label: "Brainstorming", icon: Lightbulb },
  planning: { label: "Planning", icon: FileText },
  ready: { label: "Ready", icon: CheckCircle },
  executing: { label: "Executing", icon: Play },
  done: { label: "Done", icon: Flag },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatEventContent(event: DbExecutionEvent): string {
  const metadata = event.metadata as ExecutionEventMetadata | null;

  switch (event.eventType) {
    case "file_read":
      return metadata?.filePath || event.content;
    case "file_write":
      return metadata?.filePath || event.content;
    case "command_run":
      return metadata?.command || event.content;
    case "commit":
      return metadata?.commitSha
        ? `${event.content} (${metadata.commitSha.slice(0, 7)})`
        : event.content;
    default:
      return event.content.length > 100
        ? event.content.slice(0, 100) + "..."
        : event.content;
  }
}

interface ExecutionTimelineProps {
  task: Task;
  execution: Execution | null;
  events: DbExecutionEvent[];
  className?: string;
}

export function ExecutionTimeline({ task, execution, events, className }: ExecutionTimelineProps) {
  // Determine phases and their status based on task status and processing state
  const phases = React.useMemo<PhaseData[]>(() => {
    const allPhases: Phase[] = ["brainstorming", "planning", "ready", "executing", "done"];
    const taskStatus = task.status as Phase;
    const taskStatusIndex = allPhases.indexOf(taskStatus);

    // Check if current processing phase is complete (100% progress with "complete" in status text)
    const processingPhase = task.processingPhase as Phase | null;
    const isProcessingComplete = task.processingProgress === 100 &&
      task.processingStatusText?.toLowerCase().includes("complete");

    // If processing is complete, the effective current phase should be the next one
    let effectiveCurrentIndex = taskStatusIndex;
    if (processingPhase && isProcessingComplete) {
      const processingPhaseIndex = allPhases.indexOf(processingPhase);
      // If task status matches processing phase and processing is done, move to next phase
      if (processingPhaseIndex === taskStatusIndex) {
        effectiveCurrentIndex = Math.min(processingPhaseIndex + 1, allPhases.length - 1);
      }
    }

    return allPhases.map((phase, index) => {
      let status: PhaseStatus;
      if (index < effectiveCurrentIndex) {
        status = "completed";
      } else if (index === effectiveCurrentIndex) {
        // If we're at "ready" phase because planning just completed, show as current
        status = "current";
      } else {
        status = "pending";
      }

      return {
        phase,
        status,
        startedAt: index === effectiveCurrentIndex ? task.updatedAt : undefined,
      };
    });
  }, [task.status, task.updatedAt, task.processingPhase, task.processingProgress, task.processingStatusText]);

  // Group events by their iteration/step
  const groupedEvents = React.useMemo(() => {
    // For now, just return all events chronologically
    return events;
  }, [events]);

  return (
    <div className={cn("space-y-0", className)}>
      {phases.map((phase, phaseIndex) => {
        const config = phaseConfig[phase.phase];
        const Icon = config.icon;
        const isLast = phaseIndex === phases.length - 1;
        const isExecuting = phase.phase === "executing" && phase.status === "current";

        return (
          <div key={phase.phase} className="relative flex gap-3">
            {/* Vertical line connector */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-[11px] top-8 w-0.5 -bottom-2",
                  phase.status === "completed"
                    ? "bg-primary"
                    : phase.status === "current"
                      ? "bg-gradient-to-b from-primary to-border"
                      : "bg-border"
                )}
              />
            )}

            {/* Node indicator */}
            <div className="relative z-10 shrink-0">
              {phase.status === "completed" && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
              {phase.status === "current" && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-primary-foreground" />
                </div>
              )}
              {phase.status === "pending" && (
                <div className="w-6 h-6 rounded-full border-2 border-border bg-background" />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      phase.status === "completed" && "text-primary",
                      phase.status === "current" && "text-primary",
                      phase.status === "pending" && "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "font-medium text-sm",
                      phase.status === "pending" && "text-muted-foreground"
                    )}
                  >
                    {config.label}
                  </span>

                  {/* Status badge */}
                  {phase.status === "completed" && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Complete
                    </span>
                  )}
                  {phase.status === "current" && (
                    <span className="text-xs text-primary font-medium animate-pulse">
                      In Progress
                    </span>
                  )}
                  {phase.status === "pending" && (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </div>

                {/* Duration */}
                {phase.duration !== undefined && phase.status === "completed" && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(phase.duration)}
                  </span>
                )}
              </div>

              {/* Execution progress for executing phase */}
              {isExecuting && execution && (
                <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  {task.processingStatusText && (
                    <p className="text-xs text-foreground mb-2">{task.processingStatusText}</p>
                  )}
                  {task.processingProgress !== null && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${task.processingProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Activity feed for executing phase */}
              {isExecuting && groupedEvents.length > 0 && (
                <div className="mt-3 space-y-1 border-l-2 border-border/50 pl-4 ml-1">
                  {groupedEvents.map((event) => {
                    const EventIcon = eventIcons[event.eventType] || Brain;
                    const eventTime = new Date(event.createdAt);

                    return (
                      <div key={event.id} className="flex items-start gap-2 py-1">
                        <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums mt-0.5 shrink-0">
                          {formatTime(eventTime)}
                        </span>
                        <EventIcon
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 mt-0.5",
                            event.eventType === "error" && "text-red-500",
                            event.eventType === "commit" && "text-green-500",
                            event.eventType === "file_write" && "text-blue-500",
                            event.eventType === "file_read" && "text-amber-500",
                            event.eventType === "command_run" && "text-purple-500",
                            event.eventType === "thinking" && "text-muted-foreground"
                          )}
                        />
                        <span className="text-xs text-muted-foreground truncate">
                          {formatEventContent(event)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Show events for completed executing phase */}
              {phase.phase === "executing" && phase.status === "completed" && groupedEvents.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    View {groupedEvents.length} event{groupedEvents.length !== 1 ? "s" : ""}
                  </summary>
                  <div className="mt-2 space-y-1 border-l-2 border-border/50 pl-4 ml-1">
                    {groupedEvents.slice(-20).map((event) => {
                      const EventIcon = eventIcons[event.eventType] || Brain;
                      const eventTime = new Date(event.createdAt);

                      return (
                        <div key={event.id} className="flex items-start gap-2 py-1">
                          <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums mt-0.5 shrink-0">
                            {formatTime(eventTime)}
                          </span>
                          <EventIcon
                            className={cn(
                              "w-3.5 h-3.5 shrink-0 mt-0.5",
                              event.eventType === "error" && "text-red-500",
                              event.eventType === "commit" && "text-green-500",
                              event.eventType === "file_write" && "text-blue-500",
                              event.eventType === "file_read" && "text-amber-500",
                              event.eventType === "command_run" && "text-purple-500",
                              event.eventType === "thinking" && "text-muted-foreground"
                            )}
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            {formatEventContent(event)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
