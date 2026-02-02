"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, GitBranch } from "lucide-react";
import type { Task } from "@/lib/db/schema";
import type { ExecutionGraph } from "@/lib/execution/graph-types";
import { format } from "date-fns";

interface GraphSidePanelProps {
  nodeId: string;
  tasks: Task[];
  executions: Map<string, ExecutionGraph>;
  onClose: () => void;
}

export function GraphSidePanel({
  nodeId,
  tasks,
  executions,
  onClose,
}: GraphSidePanelProps) {
  // Check if nodeId is a task or execution step
  const isExecutionStep = nodeId.includes("-step-");
  let task: Task | undefined;
  let stepInfo: { taskId: string; stepId: string } | undefined;

  if (isExecutionStep) {
    const [taskId, , stepId] = nodeId.split("-step-");
    task = tasks.find((t) => t.id === taskId);
    stepInfo = { taskId, stepId };
  } else {
    task = tasks.find((t) => t.id === nodeId);
  }

  if (!task) return null;

  const statusBadgeVariants: Record<string, string> = {
    todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    brainstorming:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    planning: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    ready:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    executing:
      "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    review: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    stuck: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const blockedByTasks = tasks.filter((t) =>
    (task?.blockedByIds || []).includes(t.id),
  );

  const blocksTasks = tasks.filter((t) =>
    (t.blockedByIds || []).includes(task!.id),
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg pr-6">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Task Details */}
          {task.description && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Description</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Status & Dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge className={statusBadgeVariants[task.status]}>
                {task.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created
              </span>
              <span>{format(new Date(task.createdAt), "MMM d, yyyy")}</span>
            </div>

            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Updated
                </span>
                <span>{format(new Date(task.updatedAt), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>

          {/* Branch Info */}
          {task.branch && (
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                <GitBranch className="h-4 w-4" />
                Branch
              </h4>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {task.branch}
              </code>
            </div>
          )}

          {/* Dependencies */}
          {blockedByTasks.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Blocked By</h4>
              <ul className="space-y-1">
                {blockedByTasks.map((t) => (
                  <li
                    key={t.id}
                    className="text-sm flex items-center gap-2 p-2 rounded bg-muted/50"
                  >
                    <Badge
                      className={statusBadgeVariants[t.status]}
                      variant="outline"
                    >
                      {t.status}
                    </Badge>
                    <span className="truncate">{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blocksTasks.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Blocks</h4>
              <ul className="space-y-1">
                {blocksTasks.map((t) => (
                  <li
                    key={t.id}
                    className="text-sm flex items-center gap-2 p-2 rounded bg-muted/50"
                  >
                    <Badge
                      className={statusBadgeVariants[t.status]}
                      variant="outline"
                    >
                      {t.status}
                    </Badge>
                    <span className="truncate">{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PR Link */}
          {task.prUrl && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Pull Request</h4>
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                #{task.prNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Step Info (if execution step) */}
          {stepInfo && executions.has(stepInfo.taskId) && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Execution Step</h4>
              <p className="text-sm text-muted-foreground">
                Step ID: {stepInfo.stepId}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
