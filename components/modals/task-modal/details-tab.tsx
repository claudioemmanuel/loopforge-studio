"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  X,
  Lightbulb,
  AlertCircle,
  Settings,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Task } from "@/lib/db/schema";
import type { ParsedAPIError } from "@/components/hooks/use-api-error";
import { TaskPlan } from "./task-plan";
import { ExecutionSummary } from "./execution-summary";
import { DependencyEditor } from "@/components/dependency-editor";
import { getStatusConfigForModal, workflowSteps } from "./task-config";
import { parseBrainstormResult, renderFormattedText } from "./utils";

interface DetailsTabProps {
  task: Task;
  apiError: ParsedAPIError | null;
  isApiKeyError: boolean;
  clearError: () => void;
  loading: boolean;
  actionType: string | null;
  isStuck: boolean;
  isEditable: boolean;
  currentStepIndex: number;
  editingDescription: boolean;
  setEditingDescription: (editing: boolean) => void;
  descriptionValue: string;
  setDescriptionValue: (value: string) => void;
  handleSaveField: (field: "title" | "description", value: string) => void;
  handlePlan: () => void;
}

/**
 * The "Details" tab content inside the task modal.
 *
 * Renders the workflow progress indicator, editable description, dependencies,
 * brainstorm result, plan content, execution summary, and the updated timestamp.
 */
export function DetailsTab({
  task,
  apiError,
  isApiKeyError,
  clearError,
  loading,
  actionType,
  isStuck,
  isEditable,
  currentStepIndex,
  editingDescription,
  setEditingDescription,
  descriptionValue,
  setDescriptionValue,
  handleSaveField,
  handlePlan,
}: DetailsTabProps) {
  const t = useTranslations();
  const statusConfig = getStatusConfigForModal(t);

  return (
    <div className="p-6 space-y-6">
      {/* Error Alert - inline display for simple errors */}
      {apiError && !apiError.action && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-destructive font-medium">
              {apiError.message}
            </p>
            {isApiKeyError && (
              <Link
                href="/settings/integrations"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
              >
                <Settings className="w-4 h-4" />
                {t("settings.goToSettings")}
              </Link>
            )}
          </div>
          <button
            onClick={clearError}
            className="flex-shrink-0 p-1 -m-1 rounded text-destructive/60 hover:text-destructive transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Workflow Progress (not for stuck tasks) */}
      {!isStuck && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("tasks.modal.workflowProgress")}
          </h3>
          <div className="flex items-center gap-1">
            {workflowSteps.map((step, index) => {
              const stepConfig = statusConfig[step];
              const StepIcon = stepConfig.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step} className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                      isCompleted && "bg-primary text-primary-foreground",
                      isCurrent && [stepConfig.bgColor, stepConfig.color],
                      !isCompleted &&
                        !isCurrent &&
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <div
                      className={cn(
                        "w-4 sm:w-8 h-0.5 mx-0.5",
                        index < currentStepIndex ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Description */}
      {(task.description || isEditable) && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("tasks.newTask.description")}
          </h3>
          {editingDescription ? (
            <textarea
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={async () => {
                const trimmed = descriptionValue.trim();
                if (trimmed !== (task.description || "")) {
                  await handleSaveField("description", trimmed);
                }
                setEditingDescription(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDescriptionValue(task.description || "");
                  setEditingDescription(false);
                }
              }}
              autoFocus
              className="w-full text-sm leading-relaxed bg-transparent border rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary resize-none min-h-[80px]"
            />
          ) : (
            <p
              className={cn(
                "text-sm leading-relaxed",
                isEditable &&
                  "cursor-pointer hover:bg-muted/50 rounded-lg p-1 -m-1 transition-colors",
                !task.description && "text-muted-foreground italic",
              )}
              onClick={() => {
                if (isEditable) {
                  setDescriptionValue(task.description || "");
                  setEditingDescription(true);
                }
              }}
              title={isEditable ? t("tasks.modal.clickToEdit") : undefined}
            >
              {task.description || t("tasks.modal.noDescription")}
            </p>
          )}
        </div>
      )}

      {/* Dependencies */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
          <ChevronRight className="w-4 h-4 text-slate-500 transition-transform duration-200 group-open:rotate-90" />
          <h3 className="text-sm font-medium">
            {t("tasks.modal.dependencies")}
          </h3>
        </summary>
        <div className="mt-3 p-4 bg-muted/30 rounded-xl border">
          <DependencyEditor taskId={task.id} repoId={task.repoId} />
        </div>
      </details>

      {/* Brainstorm Result */}
      <BrainstormResultSection brainstormResult={task.brainstormResult} />

      {/* Plan Content and Ready for Execution */}
      <TaskPlan
        task={task}
        loading={loading}
        actionType={actionType}
        onPlan={handlePlan}
      />

      {/* Execution Summary - shown for done/stuck tasks */}
      <ExecutionSummary task={task} />

      {/* Updated timestamp */}
      {task.updatedAt && (
        <div className="text-xs text-muted-foreground">
          {t("tasks.modal.lastUpdated")}{" "}
          {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-component for the brainstorm result section
// ---------------------------------------------------------------------------

function BrainstormResultSection({
  brainstormResult,
}: {
  brainstormResult: string | null;
}) {
  const t = useTranslations();

  if (!brainstormResult) return null;

  const brainstorm = parseBrainstormResult(brainstormResult);

  if (!brainstorm) {
    // Fallback to raw display if parsing fails
    return (
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
          <ChevronRight className="w-4 h-4 text-violet-500 transition-transform duration-200 group-open:rotate-90" />
          <Lightbulb className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-medium">
            {t("tasks.modal.brainstormResult")}
          </h3>
        </summary>
        <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {brainstormResult}
          </pre>
        </div>
      </details>
    );
  }

  return (
    <details className="group">
      <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
        <ChevronRight className="w-4 h-4 text-violet-500 transition-transform duration-200 group-open:rotate-90" />
        <Lightbulb className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-medium">
          {t("tasks.modal.brainstormResult")}
        </h3>
      </summary>
      <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30 space-y-4">
        {/* Summary */}
        <div>
          <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
            {t("tasks.modal.summary")}
          </h4>
          <p className="text-sm leading-relaxed">{brainstorm.summary}</p>
        </div>

        {/* Requirements */}
        {brainstorm.requirements.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
              {t("tasks.modal.requirements")}
            </h4>
            <ul className="text-sm space-y-1">
              {brainstorm.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">•</span>
                  <span>{renderFormattedText(req)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Considerations */}
        {brainstorm.considerations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
              {t("tasks.modal.considerations")}
            </h4>
            <ul className="text-sm space-y-1">
              {brainstorm.considerations.map((con, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">•</span>
                  <span>{renderFormattedText(con)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested Approach */}
        {brainstorm.suggestedApproach && (
          <div>
            <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
              {t("tasks.modal.suggestedApproach")}
            </h4>
            <p className="text-sm leading-relaxed">
              {renderFormattedText(brainstorm.suggestedApproach)}
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
