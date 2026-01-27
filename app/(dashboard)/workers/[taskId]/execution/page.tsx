"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GitBranch,
  Clock,
  FileCode,
  GitCommit,
  Activity,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RepoStatusIndicator } from "@/components/repo-status-indicator";
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineContent,
  TimelineHeader,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
} from "@/components/ui/timeline";
import type {
  Task,
  Execution,
  ExecutionEvent,
  Repo,
  IndexingStatus,
} from "@/lib/db/schema";

interface ExecutionDetailData {
  task: Task & {
    repo: Repo & { isCloned: boolean; indexingStatus: IndexingStatus };
  };
  execution: Execution | null;
  events: ExecutionEvent[];
}

type TabType = "live" | "timeline" | "files" | "commits";

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end ? new Date(end) : new Date();
  const startTime = new Date(start);
  const diffMs = endTime.getTime() - startTime.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s`;
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "thinking":
      return <Activity className="w-3 h-3 text-blue-500" />;
    case "file_read":
      return <FileCode className="w-3 h-3 text-cyan-500" />;
    case "file_write":
      return <FileCode className="w-3 h-3 text-green-500" />;
    case "commit":
      return <GitCommit className="w-3 h-3 text-purple-500" />;
    case "error":
    case "stuck":
      return <AlertTriangle className="w-3 h-3 text-red-500" />;
    case "complete":
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    default:
      return <Activity className="w-3 h-3 text-muted-foreground" />;
  }
}

function getEventDotVariant(
  eventType: string,
): "default" | "primary" | "destructive" | "muted" {
  switch (eventType) {
    case "commit":
    case "complete":
      return "primary";
    case "error":
    case "stuck":
      return "destructive";
    case "thinking":
      return "muted";
    default:
      return "default";
  }
}

// Live Stream Tab - Terminal-like output
function LiveStreamTab({
  events,
  isRunning,
}: {
  events: ExecutionEvent[];
  isRunning: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div
      ref={containerRef}
      className="h-[600px] overflow-y-auto bg-zinc-950 rounded-lg p-4 font-mono text-sm"
    >
      {events.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {isRunning ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for events...
            </div>
          ) : (
            "No events recorded"
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event, idx) => (
            <div key={event.id || idx} className="flex gap-2">
              <span className="text-zinc-500 shrink-0">
                [{formatTime(new Date(event.createdAt))}]
              </span>
              <span
                className={cn(
                  event.eventType === "error" || event.eventType === "stuck"
                    ? "text-red-400"
                    : event.eventType === "complete"
                      ? "text-green-400"
                      : event.eventType === "commit"
                        ? "text-purple-400"
                        : event.eventType === "file_write"
                          ? "text-cyan-400"
                          : "text-zinc-300",
                )}
              >
                {event.content}
              </span>
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="animate-pulse">▌</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Timeline Tab - Structured event view
function TimelineTab({ events }: { events: ExecutionEvent[] }) {
  return (
    <div className="h-[600px] overflow-y-auto p-4">
      {events.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No events recorded
        </div>
      ) : (
        <Timeline>
          {events.map((event, idx) => (
            <TimelineItem
              key={event.id || idx}
              isLast={idx === events.length - 1}
            >
              <TimelineDot
                variant={getEventDotVariant(event.eventType)}
                size="sm"
              >
                {getEventIcon(event.eventType)}
              </TimelineDot>
              <TimelineContent>
                <TimelineHeader>
                  <TimelineTitle>{event.content}</TimelineTitle>
                  <TimelineTime>
                    {formatTime(new Date(event.createdAt))}
                  </TimelineTime>
                </TimelineHeader>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <TimelineDescription>
                    {event.metadata.filePath && (
                      <span className="font-mono text-xs">
                        {event.metadata.filePath}
                      </span>
                    )}
                    {event.metadata.commitSha && (
                      <span className="font-mono text-xs">
                        Commit: {event.metadata.commitSha.slice(0, 7)}
                      </span>
                    )}
                  </TimelineDescription>
                )}
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </div>
  );
}

// Files Tab - Modified files with potential diff view
function FilesTab({ events }: { events: ExecutionEvent[] }) {
  const fileEvents = events.filter(
    (e) => e.eventType === "file_write" || e.eventType === "file_read",
  );

  const files = new Map<string, { action: string; count: number }>();
  for (const event of fileEvents) {
    const filePath =
      event.metadata?.filePath || event.content.match(/`([^`]+)`/)?.[1];
    if (filePath) {
      const existing = files.get(filePath);
      files.set(filePath, {
        action: event.eventType === "file_write" ? "modified" : "read",
        count: (existing?.count || 0) + 1,
      });
    }
  }

  return (
    <div className="h-[600px] overflow-y-auto p-4">
      {files.size === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No file changes recorded
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(files.entries()).map(([path, info]) => (
            <div
              key={path}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileCode
                  className={cn(
                    "w-4 h-4",
                    info.action === "modified"
                      ? "text-green-500"
                      : "text-blue-500",
                  )}
                />
                <span className="font-mono text-sm">{path}</span>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  info.action === "modified"
                    ? "bg-green-500/10 text-green-600"
                    : "bg-blue-500/10 text-blue-600",
                )}
              >
                {info.action}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Commits & PR Tab
function CommitsTab({
  execution,
  task,
}: {
  execution: Execution | null;
  task: Task & { repo: Repo };
}) {
  const [copied, setCopied] = useState(false);

  const copyBranch = () => {
    if (execution?.branch) {
      navigator.clipboard.writeText(execution.branch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const commits = (execution?.commits as string[]) || [];

  return (
    <div className="h-[600px] overflow-y-auto p-4 space-y-6">
      {/* Branch Info */}
      {execution?.branch && (
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Branch
          </h3>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
              {execution.branch}
            </code>
            <Button variant="ghost" size="sm" onClick={copyBranch}>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* PR Link */}
      {execution?.prUrl && (
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Pull Request
          </h3>
          <a
            href={execution.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            PR #{execution.prNumber}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Commits List */}
      <div className="p-4 rounded-lg border bg-card">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <GitCommit className="w-4 h-4" />
          Commits ({commits.length})
        </h3>
        {commits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commits yet</p>
        ) : (
          <div className="space-y-2">
            {commits.map((sha, idx) => (
              <div
                key={sha}
                className="flex items-center gap-3 p-2 rounded bg-muted/50"
              >
                <code className="font-mono text-xs">{sha.slice(0, 7)}</code>
                <span className="text-sm text-muted-foreground">
                  Commit {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [data, setData] = useState<ExecutionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const [isPolling, setIsPolling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/execution`);
      if (!response.ok) {
        throw new Error("Failed to fetch execution data");
      }
      const result = await response.json();
      setData(result);
      setError(null);

      // Check if we should continue polling
      const isRunning =
        result.task.status === "executing" ||
        result.task.status === "brainstorming" ||
        result.task.status === "planning";
      setIsPolling(isRunning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for live updates
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isPolling, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">{error || "Data not found"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { task, execution, events } = data;
  const isRunning = task.status === "executing";

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "live",
      label: "Live Stream",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: <Activity className="w-4 h-4" />,
    },
    { id: "files", label: "Files", icon: <FileCode className="w-4 h-4" /> },
    {
      id: "commits",
      label: "Commits & PR",
      icon: <GitCommit className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">{task.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href={`/repos/${task.repoId}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              {task.repo.name}
            </Link>
            <RepoStatusIndicator
              isCloned={task.repo.isCloned}
              indexingStatus={task.repo.indexingStatus}
              size="sm"
              showLabel
            />
            {execution?.startedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(
                  new Date(execution.startedAt),
                  execution.completedAt
                    ? new Date(execution.completedAt)
                    : undefined,
                )}
                {isRunning && " (running)"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Executing
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Events</p>
          <p className="text-2xl font-bold">{events.length}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Files Modified</p>
          <p className="text-2xl font-bold">
            {events.filter((e) => e.eventType === "file_write").length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Commits</p>
          <p className="text-2xl font-bold">
            {((execution?.commits as string[]) || []).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Iterations</p>
          <p className="text-2xl font-bold">{execution?.iteration || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border rounded-lg">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "live" && (
            <LiveStreamTab events={events} isRunning={isRunning} />
          )}
          {activeTab === "timeline" && <TimelineTab events={events} />}
          {activeTab === "files" && <FilesTab events={events} />}
          {activeTab === "commits" && (
            <CommitsTab execution={execution} task={task} />
          )}
        </div>
      </div>
    </div>
  );
}
