"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ActivityEvent {
  id: string;
  eventType: string;
  title: string;
  content: string | null;
  createdAt: string;
  task?: {
    id: string;
    title: string;
  };
  metadata?: Record<string, unknown>;
}

interface ActivityTabProps {
  repoId: string;
  onNewActivity?: () => void;
}

const eventIcons: Record<string, string> = {
  thinking: "🤔",
  file_read: "📖",
  file_write: "✏️",
  command_run: "⚡",
  commit: "📦",
  error: "❌",
  complete: "✅",
  stuck: "🚧",
  task_created: "📝",
  task_started: "▶️",
  task_completed: "✅",
  task_failed: "❌",
  task_auto_triggered: "🔄",
  blocker_failed: "🔒",
  execution_started: "🚀",
  execution_completed: "🎉",
  pr_created: "🔗",
  pr_merged: "🎊",
};

const eventColors: Record<string, string> = {
  thinking: "border-l-blue-400",
  file_write: "border-l-green-400",
  commit: "border-l-purple-400",
  error: "border-l-red-400",
  complete: "border-l-emerald-400",
  stuck: "border-l-orange-400",
  task_completed: "border-l-emerald-400",
  task_failed: "border-l-red-400",
  blocker_failed: "border-l-red-400",
  default: "border-l-muted-foreground",
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than a minute
  if (diff < 60000) {
    return "Just now";
  }

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // More than a day
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTab({ repoId, onNewActivity }: ActivityTabProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef<string | null>(null);

  // Fetch activity events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/activity?repoId=${repoId}&limit=50`);
        if (!res.ok) throw new Error("Failed to fetch activity");

        const data = await res.json();
        setEvents(data.events || []);

        // Check for new activity
        if (data.events?.length > 0 && lastEventIdRef.current) {
          if (data.events[0].id !== lastEventIdRef.current) {
            onNewActivity?.();
          }
        }
        lastEventIdRef.current = data.events?.[0]?.id || null;
      } catch {
        setError("Failed to load activity");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [repoId, onNewActivity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
        <span className="text-2xl">📭</span>
        <span>No activity yet</span>
      </div>
    );
  }

  return (
    <div ref={feedRef} className="h-full overflow-y-auto">
      <div className="p-3 space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className={cn(
              "p-2.5 rounded-md bg-muted/30 border-l-2",
              eventColors[event.eventType] || eventColors.default,
            )}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">
                {eventIcons[event.eventType] || "📌"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {event.title}
                </div>
                {event.content && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {event.content}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span>{formatTime(event.createdAt)}</span>
                  {event.task && (
                    <>
                      <span>·</span>
                      <span className="truncate">{event.task.title}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
