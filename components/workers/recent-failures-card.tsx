"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface FailureInfo {
  taskId: string;
  phase: string;
  error: string;
  timestamp: Date;
}

interface StuckTaskInfo {
  taskId: string;
  title: string;
  stuckDuration: string;
}

interface RecentFailuresCardProps {
  failures: {
    count: number;
    recent: FailureInfo[];
  };
  stuck: {
    count: number;
    tasks: StuckTaskInfo[];
  };
}

export function RecentFailuresCard({
  failures,
  stuck,
}: RecentFailuresCardProps) {
  const t = useTranslations("workers.health");

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const truncateError = (error: string, maxLength = 80) => {
    if (error.length <= maxLength) return error;
    return error.substring(0, maxLength) + "...";
  };

  const hasIssues = failures.count > 0 || stuck.count > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t("cards.failures.title")}
        </CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("cards.failures.recentFailures")}
              </p>
              <p
                className={`text-2xl font-bold tabular-nums ${failures.count > 0 ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"}`}
              >
                {failures.count}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("cards.failures.stuckTasks")}
              </p>
              <p
                className={`text-2xl font-bold tabular-nums ${stuck.count > 0 ? "text-yellow-600 dark:text-yellow-500" : "text-green-600 dark:text-green-500"}`}
              >
                {stuck.count}
              </p>
            </div>
          </div>

          {/* No Issues */}
          {!hasIssues && (
            <div className="pt-2 border-t">
              <p className="text-sm text-green-600 dark:text-green-500 flex items-center gap-2">
                ✓ {t("cards.failures.noIssues")}
              </p>
            </div>
          )}

          {/* Stuck Tasks List */}
          {stuck.count > 0 && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                {t("cards.failures.stuckTasksLabel")}:
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {stuck.tasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.taskId}
                    href={`/tasks/${task.taskId}`}
                    className="block p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stuck for {task.stuckDuration}
                        </p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
                {stuck.count > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{stuck.count - 5} more stuck tasks
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recent Failures List */}
          {failures.count > 0 && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-sm font-medium text-red-600 dark:text-red-500">
                {t("cards.failures.recentFailuresLabel")}:
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {failures.recent.slice(0, 5).map((failure, index) => (
                  <div
                    key={`${failure.taskId}-${index}`}
                    className="p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {failure.phase}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(failure.timestamp)}
                      </p>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      {truncateError(failure.error)}
                    </p>
                    <Link
                      href={`/tasks/${failure.taskId}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      View task
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                ))}
                {failures.count > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{failures.count - 5} more failures
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
