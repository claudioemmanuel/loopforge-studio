"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GraphNode } from "@/lib/shared/graph-types";
import { CheckCircle2, Circle, XCircle, Clock, Loader2 } from "lucide-react";

interface ExecutionStepNodeData {
  step: GraphNode;
  taskId: string;
}

export const ExecutionStepNode = memo(
  ({ data }: NodeProps<ExecutionStepNodeData>) => {
    const { step } = data;

    const statusConfig: Record<
      string,
      { icon: React.ReactNode; color: string; bgColor: string }
    > = {
      completed: {
        icon: <CheckCircle2 className="h-4 w-4" />,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-900/20 border-green-500",
      },
      running: {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20 border-blue-500",
      },
      pending: {
        icon: <Circle className="h-4 w-4" />,
        color: "text-gray-400 dark:text-gray-600",
        bgColor: "bg-gray-50 dark:bg-gray-900/20 border-gray-300",
      },
      failed: {
        icon: <XCircle className="h-4 w-4" />,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20 border-red-500",
      },
      waiting: {
        icon: <Clock className="h-4 w-4" />,
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500",
      },
    };

    const config = statusConfig[step.status] || statusConfig.pending;

    return (
      <div
        className={cn(
          "bg-card rounded-md border px-3 py-2 w-[250px] transition-all",
          config.bgColor,
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-primary !w-2 !h-2"
        />

        <div className="flex items-center gap-2">
          <div className={config.color}>{config.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" title={step.label}>
              {step.label}
            </p>
            {step.metadata?.description && (
              <p className="text-[10px] text-muted-foreground truncate">
                {step.metadata.description}
              </p>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-primary !w-2 !h-2"
        />
      </div>
    );
  },
);

ExecutionStepNode.displayName = "ExecutionStepNode";
