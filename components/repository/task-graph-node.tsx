"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/db/schema";

interface TaskNodeData {
  task: Task;
  isExpanded?: boolean;
  isSelected?: boolean;
  onToggleExpand?: () => void;
}

export const TaskGraphNode = memo((props: NodeProps) => {
  const data = props.data as unknown as TaskNodeData;
  const { task, isExpanded = false, isSelected = false, onToggleExpand } = data;

  const statusColors: Record<string, string> = {
    todo: "border-gray-500 bg-gray-50 dark:bg-gray-900",
    brainstorming:
      "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-purple-500/20 shadow-md",
    planning:
      "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-blue-500/20 shadow-md",
    ready: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
    executing:
      "border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-orange-500/30 shadow-lg",
    review: "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20",
    done: "border-green-500 bg-green-50 dark:bg-green-900/20",
    stuck:
      "border-red-500 bg-red-50 dark:bg-red-900/20 shadow-red-500/30 shadow-lg",
  };

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

  const priorityConfig: Record<
    number,
    { icon: React.ReactNode; color: string }
  > = {
    2: {
      icon: <Flame className="h-3 w-3" />,
      color: "text-red-500",
    },
    1: {
      icon: <Flame className="h-3 w-3" />,
      color: "text-yellow-500",
    },
    0: {
      icon: <Clock className="h-3 w-3" />,
      color: "text-blue-500",
    },
  };

  const hasExecutionGraph =
    task.executionGraph &&
    ["executing", "stuck", "failed", "review"].includes(task.status);

  return (
    <div
      className={cn(
        "bg-card rounded-lg border-2 p-3 w-[300px] transition-all cursor-pointer hover:shadow-lg",
        statusColors[task.status] || "border-gray-500",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {task.priority !== undefined && priorityConfig[task.priority] && (
            <div
              className={cn(
                "flex items-center",
                priorityConfig[task.priority].color,
              )}
            >
              {priorityConfig[task.priority].icon}
            </div>
          )}
        </div>

        {hasExecutionGraph && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className="hover:bg-accent rounded p-1 transition-colors"
            aria-label={
              isExpanded ? "Collapse execution steps" : "Expand execution steps"
            }
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Title */}
      <h3
        className="font-semibold text-sm mb-2 line-clamp-2 min-h-[2.5rem]"
        title={task.title}
      >
        {task.title}
      </h3>

      {/* Status Badge */}
      <Badge className={cn("text-xs mb-2", statusBadgeVariants[task.status])}>
        {task.status}
      </Badge>

      {/* Processing Progress */}
      {task.processingProgress != null && task.processingProgress > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{task.processingProgress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${task.processingProgress}%` }}
            />
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
});

TaskGraphNode.displayName = "TaskGraphNode";
