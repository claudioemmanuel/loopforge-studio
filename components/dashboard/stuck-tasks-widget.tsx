"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StuckTaskInfo {
  id: string;
  title: string;
  status: string;
  processingPhase: string | null;
  repoId: string;
  repoName: string;
  isRecovering: boolean;
  recoveryAttemptCount: number;
  lastError?: string;
  updatedAt: Date;
}

interface StuckTasksData {
  stuckTasks: StuckTaskInfo[];
  recoveringTasks: StuckTaskInfo[];
  totalCount: number;
}

export function StuckTasksWidget() {
  const [data, setData] = useState<StuckTasksData>({
    stuckTasks: [],
    recoveringTasks: [],
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStuckTasks = async () => {
      try {
        const res = await fetch("/api/dashboard/stuck-tasks");
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch stuck tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStuckTasks();
    // Refresh every 10 seconds
    const interval = setInterval(fetchStuckTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  // Don't show widget if no stuck/recovering tasks
  if (!loading && data.totalCount === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span>Tasks Needing Attention</span>
            {data.totalCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100"
              >
                {data.totalCount}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            <RefreshCw className="w-5 h-5 motion-safe:animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading stuck tasks...</p>
          </div>
        ) : (
          <>
            {/* Recovering tasks section */}
            {data.recoveringTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                  <RefreshCw className="w-4 h-4 motion-safe:animate-spin" />
                  <span>Auto-Recovery in Progress</span>
                </div>
                <div className="space-y-2">
                  {data.recoveringTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href={`/repos/${task.repoId}`}
                      className="block group"
                    >
                      <div className="flex items-start justify-between gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-white/50 dark:bg-black/20 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm text-foreground truncate">
                              {task.title}
                            </p>
                            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{task.repoName}</span>
                            {task.recoveryAttemptCount > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  Attempt {task.recoveryAttemptCount}/3
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Stuck tasks section */}
            {data.stuckTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Requires Intervention</span>
                </div>
                <div className="space-y-2">
                  {data.stuckTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href={`/repos/${task.repoId}`}
                      className="block group"
                    >
                      <div className="flex items-start justify-between gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-white/50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm text-foreground truncate">
                              {task.title}
                            </p>
                            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{task.repoName}</span>
                            {task.lastError && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[200px]">
                                  {task.lastError.slice(0, 50)}...
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Show more link if there are more tasks */}
            {data.totalCount > 3 && (
              <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  asChild
                >
                  <Link href="/dashboard">
                    View all {data.totalCount} tasks
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
