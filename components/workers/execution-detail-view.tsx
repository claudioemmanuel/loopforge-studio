"use client";

import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExecutionDetailTabs } from "./execution-detail-tabs";
import type { Execution, ExecutionEvent, Task } from "@/lib/db/schema";

interface ExecutionDetailViewProps {
  execution: Execution;
  task: Task;
  events: ExecutionEvent[];
}

export function ExecutionDetailView({
  execution,
  task,
  events,
}: ExecutionDetailViewProps) {
  const status = execution.status;

  const statusConfig = {
    queued: {
      label: "Queued",
      icon: Clock,
      iconClass: "text-slate-500",
      badgeVariant: "secondary" as const,
    },
    running: {
      label: "Running",
      icon: Loader2,
      iconClass: "animate-spin text-blue-500",
      badgeVariant: "default" as const,
    },
    completed: {
      label: "Completed",
      icon: CheckCircle2,
      iconClass: "text-emerald-500",
      badgeVariant: "default" as const,
    },
    failed: {
      label: "Failed",
      icon: XCircle,
      iconClass: "text-destructive",
      badgeVariant: "destructive" as const,
    },
    cancelled: {
      label: "Cancelled",
      icon: XCircle,
      iconClass: "text-slate-500",
      badgeVariant: "secondary" as const,
    },
  };

  const config = statusConfig[status] || statusConfig.running;
  const Icon = config.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/execution/history">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-serif font-bold tracking-tight truncate">
              {task.title}
            </h1>
            <Badge variant={config.badgeVariant} className="flex-shrink-0">
              <Icon className={cn("w-3 h-3 mr-1.5", config.iconClass)} />
              {config.label}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Started{" "}
                {formatDistanceToNow(execution.createdAt, { addSuffix: true })}
              </span>
            </div>

            {execution.completedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Completed{" "}
                  {formatDistanceToNow(execution.completedAt, {
                    addSuffix: true,
                  })}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {execution.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs with execution details */}
      <div className="bg-card border rounded-xl">
        <ExecutionDetailTabs
          task={task}
          execution={execution}
          events={events}
        />
      </div>
    </div>
  );
}
