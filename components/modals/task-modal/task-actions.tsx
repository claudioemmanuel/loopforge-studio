"use client";

import { useTranslations } from "next-intl";
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
import { getStatusConfigForModal } from "./task-config";

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
  const t = useTranslations();
  const statusConfig = getStatusConfigForModal(t);
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
            title={
              autonomousMode ? t("tasks.modal.autonomousModeActive") : undefined
            }
            className="gap-2"
          >
            {loading && actionType === "brainstorm" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {t("tasks.actions.startBrainstorming")}
          </Button>
        )}

        {task.status === "brainstorming" && task.brainstormResult && (
          <>
            <Button
              variant="outline"
              onClick={onRefine}
              disabled={loading || autonomousMode}
              title={
                autonomousMode
                  ? t("tasks.modal.autonomousModeActive")
                  : undefined
              }
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t("tasks.actions.refine")}
            </Button>
            <Button
              onClick={onPlan}
              disabled={loading || autonomousMode}
              title={
                autonomousMode
                  ? t("tasks.modal.autonomousModeActive")
                  : undefined
              }
              className="gap-2"
            >
              {loading && actionType === "plan" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {t("tasks.actions.generatePlan")}
            </Button>
          </>
        )}

        {task.status === "planning" && task.planContent && (
          <Button
            onClick={onMarkReady}
            disabled={loading || autonomousMode}
            title={
              autonomousMode ? t("tasks.modal.autonomousModeActive") : undefined
            }
            className="gap-2"
          >
            {loading && actionType === "ready" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {t("tasks.actions.markReady")}
          </Button>
        )}

        {task.status === "ready" && (
          <Button
            onClick={onStartExecution}
            disabled={loading || autonomousMode}
            title={
              autonomousMode ? t("tasks.modal.autonomousModeActive") : undefined
            }
            className="gap-2"
          >
            {loading && actionType === "execute" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {t("tasks.actions.startExecution")}
          </Button>
        )}

        {task.status === "executing" && (
          <Button variant="secondary" disabled className="gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("tasks.actions.executing")}
          </Button>
        )}

        {task.status === "review" && (
          <Button
            onClick={onReviewChanges}
            disabled={loading || autonomousMode}
            title={
              autonomousMode ? t("tasks.modal.autonomousModeActive") : undefined
            }
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {t("tasks.actions.reviewChanges")}
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
              {t("tasks.actions.rollback")}
            </Button>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">
                {t("tasks.actions.taskCompleted")}
              </span>
            </div>
          </div>
        )}

        {task.status === "stuck" && (
          <>
            <Button
              variant="outline"
              onClick={onBrainstorm}
              disabled={loading || autonomousMode}
              title={
                autonomousMode
                  ? t("tasks.modal.autonomousModeActive")
                  : undefined
              }
              className="gap-2"
            >
              {loading && actionType === "brainstorm" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t("tasks.actions.retryBrainstorming")}
            </Button>
            {task.brainstormResult && (
              <Button
                variant="outline"
                onClick={onPlan}
                disabled={loading || autonomousMode}
                title={
                  autonomousMode
                    ? t("tasks.modal.autonomousModeActive")
                    : undefined
                }
                className="gap-2"
              >
                {loading && actionType === "plan" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {t("tasks.actions.retryPlanning")}
              </Button>
            )}
            {task.planContent && (
              <Button
                onClick={onStartExecution}
                disabled={loading || autonomousMode}
                title={
                  autonomousMode
                    ? t("tasks.modal.autonomousModeActive")
                    : undefined
                }
                className="gap-2"
              >
                {loading && actionType === "execute" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {t("tasks.actions.retryExecution")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
