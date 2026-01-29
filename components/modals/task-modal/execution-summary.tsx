"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  GitPullRequest,
  ExternalLink,
  XCircle,
  ChevronRight,
} from "lucide-react";
import type { Task } from "@/lib/db/schema";

interface ExecutionSummaryProps {
  task: Task;
}

/**
 * Collapsible execution summary shown for tasks in "done" or "stuck" status.
 *
 * Displays status, PR link (if available), and branch information.
 */
export function ExecutionSummary({ task }: ExecutionSummaryProps) {
  if (task.status !== "done" && task.status !== "stuck") return null;

  const isDone = task.status === "done";

  return (
    <details className="group" open>
      <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className={cn(
            "w-4 h-4 transition-transform duration-200 group-open:rotate-90",
            isDone ? "text-emerald-500" : "text-red-500",
          )}
        />
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
        <h3 className="text-sm font-medium">Execution Summary</h3>
      </summary>
      <div
        className={cn(
          "mt-3 p-4 rounded-xl border space-y-4",
          isDone
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/30"
            : "bg-red-50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/30",
        )}
      >
        {/* Status */}
        <div className="flex items-start gap-3">
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h4
              className={cn(
                "text-xs font-semibold uppercase tracking-wide mb-1",
                isDone
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300",
              )}
            >
              Status
            </h4>
            <p className="text-sm font-medium">
              {isDone
                ? "Execution completed successfully"
                : "Execution encountered issues"}
            </p>
          </div>
        </div>

        {/* PR Link - shown for done tasks with PR */}
        {isDone && task.prUrl && (
          <div className="flex items-start gap-3">
            <GitPullRequest className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">
                Pull Request
              </h4>
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                PR #{task.prNumber}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Branch */}
        {task.branch && (
          <div className="flex items-start gap-3">
            <GitBranch
              className={cn(
                "w-4 h-4 flex-shrink-0 mt-0.5",
                isDone
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            />
            <div>
              <h4
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide mb-1",
                  isDone
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300",
                )}
              >
                Branch
              </h4>
              <code
                className={cn(
                  "text-sm font-mono px-2 py-0.5 rounded",
                  isDone
                    ? "bg-emerald-100 dark:bg-emerald-800/40"
                    : "bg-red-100 dark:bg-red-800/40",
                )}
              >
                {task.branch}
              </code>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
