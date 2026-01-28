"use client";

import { Button } from "@/components/ui/button";
import {
  FileText,
  Zap,
  Play,
  CheckCircle2,
  Sparkles,
  Loader2,
  Eye,
  RotateCcw,
} from "lucide-react";
import type { Task } from "@/lib/db/schema";
import { statusConfig } from "./task-config";

interface TaskActionsProps {
  task: Task;
  loading: boolean;
  actionType: string | null;
  autonomousMode: boolean;
  onBrainstorm: () => void;
  onRefine: () => void;
  onPlan: () => void;
  onMarkReady: () => void;
  onStartExecution: () => void;
  onReviewChanges: () => void;
  onShowRollback: () => void;
}

export function TaskActions({
  task,
  loading,
  actionType,
  autonomousMode,
  onBrainstorm,
  onRefine,
  onPlan,
  onMarkReady,
  onStartExecution,
  onReviewChanges,
  onShowRollback,
}: TaskActionsProps) {
  const config = statusConfig[task.status];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-t bg-muted/30">
      <p className="text-sm text-muted-foreground order-2 sm:order-1">
        {config.description}
      </p>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
        {/* Action buttons based on status - disabled (not hidden) when autonomous mode is active */}
        {task.status === "todo" && (
          <Button
            onClick={onBrainstorm}
            disabled={loading || autonomousMode}
            title={autonomousMode ? "Autonomous mode active" : undefined}
            className="gap-2"
          >
            {loading && actionType === "brainstorm" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Start Brainstorming
          </Button>
        )}

        {task.status === "brainstorming" && task.brainstormResult && (
          <>
            <Button
              variant="outline"
              onClick={onRefine}
              disabled={loading || autonomousMode}
              title={autonomousMode ? "Autonomous mode active" : undefined}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Refine
            </Button>
            <Button
              onClick={onPlan}
              disabled={loading || autonomousMode}
              title={autonomousMode ? "Autonomous mode active" : undefined}
              className="gap-2"
            >
              {loading && actionType === "plan" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Generate Plan
            </Button>
          </>
        )}

        {task.status === "planning" && task.planContent && (
          <Button
            onClick={onMarkReady}
            disabled={loading || autonomousMode}
            title={autonomousMode ? "Autonomous mode active" : undefined}
            className="gap-2"
          >
            {loading && actionType === "ready" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Mark Ready
          </Button>
        )}

        {task.status === "ready" && (
          <Button
            onClick={onStartExecution}
            disabled={loading || autonomousMode}
            title={autonomousMode ? "Autonomous mode active" : undefined}
            className="gap-2"
          >
            {loading && actionType === "execute" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Start Execution
          </Button>
        )}

        {task.status === "executing" && (
          <Button variant="secondary" disabled className="gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Executing...
          </Button>
        )}

        {task.status === "review" && (
          <Button
            onClick={onReviewChanges}
            disabled={loading || autonomousMode}
            title={autonomousMode ? "Autonomous mode active" : undefined}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Review Changes
          </Button>
        )}

        {task.status === "done" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onShowRollback}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Rollback
            </Button>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Task Completed</span>
            </div>
          </div>
        )}

        {task.status === "stuck" && (
          <>
            <Button
              variant="outline"
              onClick={onBrainstorm}
              disabled={loading || autonomousMode}
              title={autonomousMode ? "Autonomous mode active" : undefined}
              className="gap-2"
            >
              {loading && actionType === "brainstorm" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Retry Brainstorming
            </Button>
            {task.brainstormResult && (
              <Button
                variant="outline"
                onClick={onPlan}
                disabled={loading || autonomousMode}
                title={autonomousMode ? "Autonomous mode active" : undefined}
                className="gap-2"
              >
                {loading && actionType === "plan" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Retry Planning
              </Button>
            )}
            {task.planContent && (
              <Button
                onClick={onStartExecution}
                disabled={loading || autonomousMode}
                title={autonomousMode ? "Autonomous mode active" : undefined}
                className="gap-2"
              >
                {loading && actionType === "execute" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Retry Execution
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
