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
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionEvent, Task, Execution } from "@/lib/db/schema";
import type { ExecutionEventMetadata } from "@/lib/ralph/types";

type TabId = "workflow" | "files" | "commits";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: "workflow", label: "Workflow", icon: Clock },
  { id: "files", label: "Files", icon: FileText },
  { id: "commits", label: "Commits", icon: GitCommit },
];

// Event icons mapping
const eventIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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
  task: _task,
  execution,
  events,
  className,
}: ExecutionDetailTabsProps) {
  const [activeTab, setActiveTab] = React.useState<TabId>("workflow");
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string | null>(
    null,
  );

  // Calculate stats
  const stats = React.useMemo(() => {
    const filesRead = new Set<string>();
    const filesWritten = new Set<string>();

    for (const event of events) {
      const metadata = event.metadata as ExecutionEventMetadata | null;

      switch (event.eventType) {
        case "file_read":
          if (metadata?.filePath) filesRead.add(metadata.filePath);
          break;
        case "file_write":
          if (metadata?.filePath) filesWritten.add(metadata.filePath);
          break;
      }
    }

    return {
      filesRead: Array.from(filesRead),
      filesWritten: Array.from(filesWritten),
    };
  }, [events]);

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
                  : "border-transparent text-muted-foreground hover:text-foreground",
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
        {activeTab === "workflow" && (
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
                    : "bg-muted hover:bg-muted/80 text-muted-foreground",
                )}
              >
                All ({events.length})
              </button>
              {eventTypes.map((type) => {
                const count = events.filter((e) => e.eventType === type).length;
                return (
                  <button
                    key={type}
                    onClick={() =>
                      setEventTypeFilter(type === eventTypeFilter ? null : type)
                    }
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors",
                      eventTypeFilter === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground",
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
                  const colorClass =
                    eventColors[event.eventType] || "text-muted-foreground";
                  const eventTime = new Date(event.createdAt);

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border"
                    >
                      <EventIcon
                        className={cn("w-4 h-4 shrink-0 mt-0.5", colorClass)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {eventTypeLabels[event.eventType] ||
                              event.eventType}
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
                <p className="text-sm text-muted-foreground">
                  No files were modified
                </p>
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
                <p className="text-sm text-muted-foreground">
                  No files were read
                </p>
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
                      (e.metadata as ExecutionEventMetadata | null)
                        ?.commitSha === sha,
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
