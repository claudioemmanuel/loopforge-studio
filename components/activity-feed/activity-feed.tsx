"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface ActivityEvent {
  id: string;
  type: "thinking" | "file_read" | "file_write" | "command_run" | "commit" | "error" | "complete" | "stuck";
  content: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  executionId: string;
}

const eventIcons: Record<ActivityEvent["type"], string> = {
  thinking: "🤔",
  file_read: "📖",
  file_write: "✏️",
  command_run: "⚡",
  commit: "📦",
  error: "❌",
  complete: "✅",
  stuck: "🚧",
};

const eventColors: Record<ActivityEvent["type"], string> = {
  thinking: "border-l-blue-400",
  file_read: "border-l-cyan-400",
  file_write: "border-l-green-400",
  command_run: "border-l-yellow-400",
  commit: "border-l-purple-400",
  error: "border-l-red-400",
  complete: "border-l-emerald-400",
  stuck: "border-l-orange-400",
};

export function ActivityFeed({ executionId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch existing events
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/executions/${executionId}/events`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();

    // Poll for new events (simpler than WebSocket for initial implementation)
    const interval = setInterval(fetchEvents, 2000);

    return () => clearInterval(interval);
  }, [executionId]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="font-semibold text-sm">Activity Feed</h3>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
            )}
          />
          <span className="text-xs text-muted-foreground">
            {events.length} events
          </span>
        </div>
      </div>

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
                eventColors[event.type]
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{eventIcons[event.type]}</span>
                <span className="font-medium capitalize">
                  {event.type.replace("_", " ")}
                </span>
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
