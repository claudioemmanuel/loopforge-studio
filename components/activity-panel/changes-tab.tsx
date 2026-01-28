"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  FileCode,
  Plus,
  Minus,
  Edit2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface PendingChange {
  id: string;
  taskId: string;
  filePath: string;
  action: "create" | "modify" | "delete";
  isApproved: boolean;
  task: {
    id: string;
    title: string;
  };
}

interface ChangesTabProps {
  repoId: string;
}

const actionIcons = {
  create: Plus,
  modify: Edit2,
  delete: Minus,
};

const actionColors = {
  create: "text-green-500",
  modify: "text-amber-500",
  delete: "text-red-500",
};

export function ChangesTab({ repoId }: ChangesTabProps) {
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChanges = async () => {
      try {
        const res = await fetch(`/api/activity/changes?repoId=${repoId}`);
        if (!res.ok) throw new Error("Failed to fetch changes");

        const data = await res.json();
        setChanges(data.changes || []);
      } catch {
        setError("Failed to load changes");
      } finally {
        setLoading(false);
      }
    };

    fetchChanges();
    const interval = setInterval(fetchChanges, 10000); // Poll every 10s
    return () => clearInterval(interval);
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

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
        <FileCode className="w-8 h-8 text-muted-foreground/50" />
        <span>No pending changes</span>
        <span className="text-xs">
          Changes will appear here after execution
        </span>
      </div>
    );
  }

  // Group changes by task
  const changesByTask = changes.reduce(
    (acc, change) => {
      const taskId = change.task.id;
      if (!acc[taskId]) {
        acc[taskId] = {
          task: change.task,
          changes: [],
        };
      }
      acc[taskId].changes.push(change);
      return acc;
    },
    {} as Record<
      string,
      { task: { id: string; title: string }; changes: PendingChange[] }
    >,
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        {Object.entries(changesByTask).map(([taskId, { task, changes }]) => (
          <div key={taskId} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate flex-1">
                {task.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 px-2 gap-1"
              >
                <Link href={`?task=${taskId}`}>
                  Review
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </Button>
            </div>

            <div className="space-y-1">
              {changes.slice(0, 5).map((change) => {
                const Icon = actionIcons[change.action];
                return (
                  <div
                    key={change.id}
                    className={cn(
                      "flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30",
                      change.isApproved && "opacity-50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0",
                        actionColors[change.action],
                      )}
                    />
                    <span className="font-mono truncate">
                      {change.filePath}
                    </span>
                    {change.isApproved && (
                      <span className="text-green-500 ml-auto">✓</span>
                    )}
                  </div>
                );
              })}
              {changes.length > 5 && (
                <div className="text-xs text-muted-foreground pl-6">
                  +{changes.length - 5} more files
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
