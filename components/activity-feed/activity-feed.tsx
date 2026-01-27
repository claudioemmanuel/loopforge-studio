"use client";

import { useEffect, useState, useRef } from "react";
import { clientLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";

// Legacy execution event type (kept for backward compatibility)
interface ExecutionActivityEvent {
  id: string;
  type:
    | "thinking"
    | "file_read"
    | "file_write"
    | "command_run"
    | "commit"
    | "error"
    | "complete"
    | "stuck"
    // Setup phase events
    | "setup_start"
    | "repo_clone"
    | "repo_update"
    | "branch_create"
    | "branch_checkout"
    | "setup_complete";
  content: string;
  timestamp: Date;
  metadata?: {
    progressPercent?: number;
    phase?: string;
    [key: string]: unknown;
  };
}

// Props for the execution-specific activity feed
interface ExecutionActivityFeedProps {
  executionId: string;
}

const eventIcons: Record<ExecutionActivityEvent["type"], string> = {
  thinking: "🤔",
  file_read: "📖",
  file_write: "✏️",
  command_run: "⚡",
  commit: "📦",
  error: "❌",
  complete: "✅",
  stuck: "🚧",
  // Setup phase icons
  setup_start: "🚀",
  repo_clone: "📥",
  repo_update: "🔄",
  branch_create: "🌿",
  branch_checkout: "📍",
  setup_complete: "✨",
};

const eventColors: Record<ExecutionActivityEvent["type"], string> = {
  thinking: "border-l-blue-400",
  file_read: "border-l-cyan-400",
  file_write: "border-l-green-400",
  command_run: "border-l-yellow-400",
  commit: "border-l-purple-400",
  error: "border-l-red-400",
  complete: "border-l-emerald-400",
  stuck: "border-l-orange-400",
  // Setup phase colors
  setup_start: "border-l-indigo-400",
  repo_clone: "border-l-violet-400",
  repo_update: "border-l-violet-400",
  branch_create: "border-l-teal-400",
  branch_checkout: "border-l-teal-400",
  setup_complete: "border-l-sky-400",
};

// Format elapsed time as MM:SS
function formatElapsedTime(startTime: Date): string {
  const elapsed = Math.floor(
    (Date.now() - new Date(startTime).getTime()) / 1000,
  );
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Execution-specific activity feed (used during task execution)
export function ExecutionActivityFeed({
  executionId,
}: ExecutionActivityFeedProps) {
  const [events, setEvents] = useState<ExecutionActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("0:00");
  const feedRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    // Fetch existing events
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/executions/${executionId}/events`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);

          // Set start time from first event if not already set
          if (data.length > 0 && !startTimeRef.current) {
            startTimeRef.current = new Date(data[0].timestamp);
          }
        }
      } catch (error) {
        clientLogger.error("Error fetching events", { error });
      }
    };

    fetchEvents();

    // Poll for new events (simpler than WebSocket for initial implementation)
    const interval = setInterval(fetchEvents, 2000);

    return () => clearInterval(interval);
  }, [executionId]);

  // Update elapsed time every second
  useEffect(() => {
    if (!startTimeRef.current) return;

    const updateElapsed = () => {
      if (startTimeRef.current) {
        setElapsedTime(formatElapsedTime(startTimeRef.current));
      }
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);

    return () => clearInterval(timer);
  }, [events.length]); // Re-run when events change

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  // Get latest progress from events
  const latestProgress = events.reduce((max, event) => {
    const progress = event.metadata?.progressPercent;
    return typeof progress === "number" && progress > max ? progress : max;
  }, 0);

  // Check if execution is complete or stuck
  const isFinished = events.some(
    (e) => e.type === "complete" || e.type === "stuck" || e.type === "error",
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="font-semibold text-sm">Activity Feed</h3>
        <div className="flex items-center gap-3">
          {/* Elapsed time */}
          <span className="text-xs font-mono text-muted-foreground">
            {elapsedTime}
          </span>
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isFinished
                ? "bg-gray-400"
                : isConnected
                  ? "bg-green-500"
                  : "bg-yellow-500 animate-pulse",
            )}
          />
          <span className="text-xs text-muted-foreground">
            {events.length} events
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {latestProgress > 0 && (
        <div className="px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500 ease-out rounded-full",
                  isFinished
                    ? events.some((e) => e.type === "complete")
                      ? "bg-emerald-500"
                      : "bg-red-500"
                    : "bg-blue-500",
                )}
                style={{ width: `${Math.min(latestProgress, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-10 text-right">
              {Math.round(latestProgress)}%
            </span>
          </div>
        </div>
      )}

      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {events.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Waiting for events...
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "p-3 bg-card rounded-lg border-l-4 text-sm",
                eventColors[event.type] || "border-l-gray-400",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{eventIcons[event.type] || "📌"}</span>
                <span className="font-medium capitalize">
                  {event.type.replace(/_/g, " ")}
                </span>
                {event.metadata?.phase === "setup" && (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                    Setup
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                {event.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Enhanced Activity Feed (with filtering, search, daily summaries)
// =============================================================================

import {
  useActivityFeed,
  type ActivityFilters,
} from "@/components/hooks/use-activity-feed";
import { FilterBar } from "./filter-bar";
import { DailySummary } from "./daily-summary";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnhancedActivityFeedProps {
  repoId?: string;
  taskId?: string;
  onTaskClick?: (taskId: string) => void;
  onRepoClick?: (repoId: string) => void;
  className?: string;
}

export function ActivityFeed({
  repoId,
  taskId,
  onTaskClick,
  onRepoClick,
  className,
}: EnhancedActivityFeedProps) {
  const {
    events,
    summaries,
    groupedByDay,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    filters,
    setFilters,
    isLive,
    setIsLive,
    refresh,
    loadMore,
  } = useActivityFeed({
    repoId,
    taskId,
    enableLive: true,
  });

  // Sort days in descending order (newest first)
  const sortedDays = Array.from(groupedByDay.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refresh}
        isLive={isLive}
        onLiveToggle={setIsLive}
        isLoading={isLoading}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading state */}
        {isLoading && events.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading activity...
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-500 mb-2">
              Failed to load activity: {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && events.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No activity found</p>
            {filters.search && (
              <p className="text-xs mt-1">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        )}

        {/* Daily summaries */}
        {!isLoading && events.length > 0 && (
          <div className="space-y-4">
            {sortedDays.map((dayKey, index) => {
              const dayEvents = groupedByDay.get(dayKey) || [];
              const daySummary = summaries.get(dayKey);
              const date = new Date(dayKey);

              return (
                <DailySummary
                  key={dayKey}
                  date={date}
                  summary={daySummary}
                  events={dayEvents}
                  defaultExpanded={index === 0} // Expand today
                  onTaskClick={onTaskClick}
                  onRepoClick={onRepoClick}
                />
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="text-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
