"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, GitBranch, ArrowRight } from "lucide-react";
import type { Task } from "@/lib/db/schema";
import type { TaskLifecycleNode } from "@/lib/shared/task-lifecycle-graph";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface GraphSidePanelProps {
  nodeId: string;
  tasks: Task[];
  lifecycleNodes: TaskLifecycleNode[];
  onClose: () => void;
}

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

export function GraphSidePanel({
  nodeId,
  tasks,
  lifecycleNodes,
  onClose,
}: GraphSidePanelProps) {
  const lifecycleNode = lifecycleNodes.find((node) => node.id === nodeId);
  if (!lifecycleNode) return null;

  const task = tasks.find((item) => item.id === lifecycleNode.taskId);
  if (!task) return null;

  const blockedByTasks = tasks.filter((item) =>
    (task.blockedByIds || []).includes(item.id),
  );
  const blocksTasks = tasks.filter((item) =>
    (item.blockedByIds || []).includes(task.id),
  );

  const eventDate = new Date(lifecycleNode.timestamp);
  const eventDateLabel = Number.isNaN(eventDate.getTime())
    ? "Unknown"
    : format(eventDate, "MMM d, yyyy HH:mm");

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-lg">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3">
            <h4 className="text-sm font-semibold">{lifecycleNode.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {lifecycleNode.description}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{eventDateLabel}</span>
              </div>
              <div className="text-right text-muted-foreground">
                Triggered by {lifecycleNode.triggeredBy}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {lifecycleNode.fromStatus ? (
                <>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      statusBadgeVariants[lifecycleNode.fromStatus],
                    )}
                  >
                    {lifecycleNode.fromStatus}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </>
              ) : null}
              <Badge
                className={cn(
                  "text-[10px]",
                  statusBadgeVariants[lifecycleNode.toStatus],
                )}
              >
                {lifecycleNode.toStatus}
              </Badge>
            </div>
          </div>

          {task.description ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Task Description</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {task.description}
              </p>
            </div>
          ) : null}

          {task.brainstormSummary ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Brainstorm Summary</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {task.brainstormSummary}
              </p>
            </div>
          ) : null}

          {task.planContent ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Plan</h4>
              <p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                {task.planContent}
              </p>
            </div>
          ) : null}

          {task.branch ? (
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <GitBranch className="h-4 w-4" />
                Branch
              </h4>
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {task.branch}
              </code>
            </div>
          ) : null}

          {task.prUrl ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Pull Request</h4>
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                #{task.prNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : null}

          {blockedByTasks.length > 0 ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Blocked By</h4>
              <ul className="space-y-1">
                {blockedByTasks.map((item) => (
                  <li
                    key={item.id}
                    className="rounded bg-muted/50 px-2 py-1 text-sm text-muted-foreground"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {blocksTasks.length > 0 ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Blocks</h4>
              <ul className="space-y-1">
                {blocksTasks.map((item) => (
                  <li
                    key={item.id}
                    className="rounded bg-muted/50 px-2 py-1 text-sm text-muted-foreground"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
