"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  History,
  CheckCircle2,
  XCircle,
  GitBranch,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

interface Execution {
  id: string;
  taskId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  createdAt: string;
  completedAt: string | null;
  reverted: boolean;
  task: {
    id: string;
    title: string;
  };
  _count: {
    commits: number;
  };
}

interface HistoryTabProps {
  repoId: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryTab({ repoId }: HistoryTabProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(
          `/api/activity/history?repoId=${repoId}&limit=20`,
        );
        if (!res.ok) throw new Error("Failed to fetch history");

        const data = await res.json();
        setExecutions(data.executions || []);
      } catch {
        setError("Failed to load history");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [repoId]);

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

  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
        <History className="w-8 h-8 text-muted-foreground/50" />
        <span>No execution history</span>
        <span className="text-xs">Completed executions will appear here</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-2">
        {executions.map((execution) => (
          <div
            key={execution.id}
            className={cn(
              "p-3 rounded-md bg-muted/30 space-y-2",
              execution.reverted && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {execution.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : execution.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {execution.task.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(execution.createdAt)}
                  </div>
                </div>
              </div>
              {execution.reverted && (
                <span className="text-xs bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">
                  Reverted
                </span>
              )}
            </div>

            {/* Branch and PR info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {execution.branch && (
                <div className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  <span className="font-mono truncate max-w-[120px]">
                    {execution.branch}
                  </span>
                </div>
              )}
              {execution.prUrl && (
                <a
                  href={execution.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span>PR #{execution.prNumber}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 px-2 text-xs"
              >
                <Link href={`?task=${execution.taskId}`}>View Task</Link>
              </Button>
              {execution.status === "completed" && !execution.reverted && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-amber-500 hover:text-amber-500 hover:bg-amber-500/10"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Rollback
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
