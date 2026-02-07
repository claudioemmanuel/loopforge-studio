"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Calendar, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/db/schema";
import type { TaskLifecycleNode as LifecycleNode } from "@/lib/shared/task-lifecycle-graph";

interface TaskLifecycleNodeData {
  event: LifecycleNode;
  task: Task;
  isSelected?: boolean;
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

export const TaskLifecycleNode = memo((props: NodeProps) => {
  const data = props.data as unknown as TaskLifecycleNodeData;
  const { event, task, isSelected = false } = data;

  const eventDate = new Date(event.timestamp);
  const formattedTime = Number.isNaN(eventDate.getTime())
    ? "Unknown time"
    : eventDate.toLocaleString();

  return (
    <div
      className={cn(
        "w-[250px] rounded-xl border bg-card px-3 py-2 shadow-sm transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary/70"
      />

      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase text-muted-foreground">
          {task.title}
        </p>
        <CircleDot className="h-3.5 w-3.5 text-primary" />
      </div>

      <p className="line-clamp-2 text-sm font-medium">{event.title}</p>

      <div className="mt-2 flex items-center gap-2">
        <Badge
          className={cn("text-[10px]", statusBadgeVariants[event.toStatus])}
        >
          {event.toStatus}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {event.triggeredBy}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span className="truncate">{formattedTime}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary/70"
      />
    </div>
  );
});

TaskLifecycleNode.displayName = "TaskLifecycleNode";
