"use client";

import * as React from "react";
import {
  Brain,
  BookOpen,
  Edit3,
  Terminal,
  GitCommit,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Lightbulb,
  Play,
  Flag,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionEvent, Task, Execution } from "@/lib/db/schema";
import type { ExecutionEventMetadata } from "@/lib/ralph/types";

type TabId = "overview" | "timeline" | "files" | "commits";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: "overview", label: "Overview", icon: Lightbulb },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "files", label: "Files", icon: FileText },
  { id: "commits", label: "Commits", icon: GitCommit },
];

// Event icons mapping
const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  thinking: Brain,
  file_read: BookOpen,
  file_write: Edit3,
  command_run: Terminal,
  commit: GitCommit,
  error: AlertTriangle,
  complete: CheckCircle2,
  stuck: AlertTriangle,
};

// Event colors
const eventColors: Record<string, string> = {
  thinking: "text-muted-foreground",
  file_read: "text-amber-500",
  file_write: "text-blue-500",
  command_run: "text-purple-500",
  commit: "text-green-500",
  error: "text-red-500",
  complete: "text-green-500",
  stuck: "text-amber-500",
};

// Event type labels
const eventTypeLabels: Record<string, string> = {
  thinking: "AI Reasoning",
  file_read: "File Read",
  file_write: "File Write",
  command_run: "Command",
  commit: "Commit",
  error: "Error",
  complete: "Complete",
  stuck: "Failed",
};

type Phase = "brainstorming" | "planning" | "ready" | "executing" | "done";

interface PhaseInfo {
  phase: Phase;
  status: "completed" | "current" | "pending";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatEventContent(event: ExecutionEvent): string {
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
      return event.content;
  }
}

interface ExecutionDetailTabsProps {
  task: Task;
  execution: Execution | null;
  events: ExecutionEvent[];
  className?: string;
}

export function ExecutionDetailTabs({
  task,
  execution,
  events,
  className,
}: ExecutionDetailTabsProps) {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string | null>(null);

  // Calculate stats
  const stats = React.useMemo(() => {
    const filesRead = new Set<string>();
    const filesWritten = new Set<string>();
    const commandsRun: string[] = [];
    let thinkingCount = 0;
    let errorCount = 0;

    for (const event of events) {
      const metadata = event.metadata as ExecutionEventMetadata | null;

      switch (event.eventType) {
        case "file_read":
          if (metadata?.filePath) filesRead.add(metadata.filePath);
          break;
        case "file_write":
          if (metadata?.filePath) filesWritten.add(metadata.filePath);
          break;
        case "command_run":
          if (metadata?.command) commandsRun.push(metadata.command);
          break;
        case "thinking":
          thinkingCount++;
          break;
        case "error":
          errorCount++;
          break;
      }
    }

    return {
      filesRead: Array.from(filesRead),
      filesWritten: Array.from(filesWritten),
      commandsRun,
      thinkingCount,
      errorCount,
      totalEvents: events.length,
    };
  }, [events]);

  // Get phases with status
  const phases = React.useMemo<PhaseInfo[]>(() => {
    const allPhases: Phase[] = ["brainstorming", "planning", "ready", "executing", "done"];
    const phaseConfig: Record<Phase, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
      brainstorming: { label: "Brainstorming", icon: Lightbulb },
      planning: { label: "Planning", icon: FileText },
      ready: { label: "Ready", icon: CheckCircle2 },
      executing: { label: "Executing", icon: Play },
      done: { label: "Done", icon: Flag },
    };

    const taskStatus = task.status as Phase;
    const currentIndex = allPhases.indexOf(taskStatus);

    return allPhases.map((phase, index) => ({
      phase,
      status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending",
      ...phaseConfig[phase],
    }));
  }, [task.status]);

  // Filter events by type
  const filteredEvents = React.useMemo(() => {
    if (!eventTypeFilter) return events;
    return events.filter((e) => e.eventType === eventTypeFilter);
  }, [events, eventTypeFilter]);

  // Get unique event types for filter
  const eventTypes = React.useMemo(() => {
    const types = new Set(events.map((e) => e.eventType));
    return Array.from(types);
  }, [events]);

  // Calculate duration
  const duration = React.useMemo(() => {
    if (!execution?.startedAt) return null;
    const end = execution.completedAt || new Date();
    const start = new Date(execution.startedAt);
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }, [execution]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Phase timeline */}
            <div>
              <h3 className="text-sm font-medium mb-3">Workflow Progress</h3>
              <div className="flex items-center gap-2">
                {phases.map((phase, index) => {
                  const Icon = phase.icon;
                  const isLast = index === phases.length - 1;

                  return (
                    <React.Fragment key={phase.phase}>
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                          phase.status === "completed" && "bg-primary/10 text-primary",
                          phase.status === "current" && "bg-primary text-primary-foreground",
                          phase.status === "pending" && "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {phase.label}
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            "w-6 h-0.5",
                            phase.status === "completed" ? "bg-primary" : "bg-muted"
                          )}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div>
              <h3 className="text-sm font-medium mb-3">Execution Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {duration ? formatDuration(duration) : "-"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Edit3 className="w-4 h-4" />
                    <span className="text-xs">Files Modified</span>
                  </div>
                  <p className="text-lg font-semibold">{stats.filesWritten.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Terminal className="w-4 h-4" />
                    <span className="text-xs">Commands Run</span>
                  </div>
                  <p className="text-lg font-semibold">{stats.commandsRun.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <GitCommit className="w-4 h-4" />
                    <span className="text-xs">Commits</span>
                  </div>
                  <p className="text-lg font-semibold">{execution?.commits?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Error info */}
            {execution?.errorMessage && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">Execution Error</p>
                    <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                      {execution.errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => setEventTypeFilter(null)}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  !eventTypeFilter
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                All ({events.length})
              </button>
              {eventTypes.map((type) => {
                const count = events.filter((e) => e.eventType === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => setEventTypeFilter(type === eventTypeFilter ? null : type)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors",
                      eventTypeFilter === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {eventTypeLabels[type] || type} ({count})
                  </button>
                );
              })}
            </div>

            {/* Events list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No events to display</p>
                </div>
              ) : (
                filteredEvents.map((event) => {
                  const EventIcon = eventIcons[event.eventType] || Brain;
                  const colorClass = eventColors[event.eventType] || "text-muted-foreground";
                  const eventTime = new Date(event.createdAt);

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border"
                    >
                      <EventIcon className={cn("w-4 h-4 shrink-0 mt-0.5", colorClass)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {eventTypeLabels[event.eventType] || event.eventType}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 font-mono">
                            {formatTime(eventTime)}
                          </span>
                        </div>
                        <p className="text-sm mt-1 break-words">
                          {formatEventContent(event)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-6">
            {/* Files written */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-500" />
                Files Modified ({stats.filesWritten.length})
              </h3>
              {stats.filesWritten.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files were modified</p>
              ) : (
                <div className="space-y-1">
                  {stats.filesWritten.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm font-mono"
                    >
                      <span className="text-blue-500">M</span>
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Files read */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-500" />
                Files Read ({stats.filesRead.length})
              </h3>
              {stats.filesRead.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files were read</p>
              ) : (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {stats.filesRead.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm font-mono"
                    >
                      <span className="text-amber-500">R</span>
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "commits" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-green-500" />
              Commits ({execution?.commits?.length || 0})
            </h3>
            {!execution?.commits || execution.commits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No commits were made</p>
              </div>
            ) : (
              <div className="space-y-2">
                {execution.commits.map((sha, index) => {
                  // Find the commit event for this SHA
                  const commitEvent = events.find(
                    (e) =>
                      e.eventType === "commit" &&
                      (e.metadata as ExecutionEventMetadata | null)?.commitSha === sha
                  );

                  return (
                    <div
                      key={sha}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border"
                    >
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <GitCommit className="w-3.5 h-3.5 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-green-600 dark:text-green-400">
                            {sha.slice(0, 7)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Commit #{index + 1}
                          </span>
                        </div>
                        {commitEvent && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {commitEvent.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
