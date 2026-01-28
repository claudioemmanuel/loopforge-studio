"use client";

import { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { clientLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  X,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Loader2,
  ChevronRight,
  AlertCircle,
  Settings,
  ExternalLink,
  GitPullRequest,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type {
  Task,
  TaskStatus,
  Execution,
  ExecutionEvent,
} from "@/lib/db/schema";
import dynamic from "next/dynamic";
import { useAPIError } from "@/components/hooks/use-api-error";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TaskModalTabs, TimelineTab, type TabId } from "./task-modal/";
import { TaskHeader } from "./task-modal/task-header";
import { TaskPlan } from "./task-modal/task-plan";
import { TaskActions } from "./task-modal/task-actions";
import { statusConfig, workflowSteps } from "./task-modal/task-config";
import { ExecutionDetailTabs } from "@/components/workers/execution-detail-tabs";
import { DependencyEditor } from "@/components/dependency-editor";

const BrainstormPanel = dynamic(() =>
  import("@/components/brainstorm").then((mod) => mod.BrainstormPanel),
);

const DiffModal = dynamic(() =>
  import("@/components/diff-preview/diff-modal").then((mod) => mod.DiffModal),
);

const RollbackModal = dynamic(() =>
  import("@/components/rollback/rollback-modal").then(
    (mod) => mod.RollbackModal,
  ),
);

// Helper to strip markdown code blocks
function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim();
  // Remove opening code fence with optional language
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  // Remove closing code fence
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Helper to parse brainstorm result
interface BrainstormResult {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

function parseBrainstormResult(result: string | null): BrainstormResult | null {
  if (!result) return null;
  try {
    // First try parsing as-is
    const parsed = JSON.parse(result);
    // If suggestedApproach looks like raw JSON, try to extract actual value
    if (
      parsed.suggestedApproach?.startsWith("```") ||
      parsed.suggestedApproach?.startsWith("{")
    ) {
      const stripped = stripMarkdownCodeBlocks(parsed.suggestedApproach);
      try {
        const nested = JSON.parse(stripped);
        // Use fields from nested if they exist
        return {
          summary: nested.summary || parsed.summary,
          requirements: nested.requirements?.length
            ? nested.requirements
            : parsed.requirements,
          considerations: nested.considerations?.length
            ? nested.considerations
            : parsed.considerations,
          suggestedApproach:
            nested.suggestedApproach || parsed.suggestedApproach,
        };
      } catch {
        // Keep original parsed if nested parsing fails
      }
    }
    return parsed;
  } catch {
    // Try stripping markdown first, then parse
    try {
      const stripped = stripMarkdownCodeBlocks(result);
      return JSON.parse(stripped);
    } catch {
      // If still fails, return null to show raw text
      return null;
    }
  }
}

interface TaskModalProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  autoStartBrainstorm?: boolean;
  /** Callback to trigger async processing (same as card button) */
  onStart?: (taskId: string) => Promise<void>;
  /** Callback to advance task to next phase */
  onAdvance?: (
    taskId: string,
    action: "plan" | "ready" | "execute",
  ) => Promise<void>;
}

// Simple markdown-like text renderer
function renderFormattedText(text: string): React.ReactNode {
  // Split by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function TaskModal({
  task,
  onClose,
  onUpdate,
  autoStartBrainstorm = false,
  onStart,
  onAdvance,
}: TaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [showBrainstormPanel, setShowBrainstormPanel] = useState(false);
  const [autoStartTriggered, setAutoStartTriggered] = useState(false);
  const [autonomousMode, setAutonomousMode] = useState(
    task.autonomousMode ?? false,
  );
  const [togglingAutonomous, setTogglingAutonomous] = useState(false);
  const [showAutonomousConfirm, setShowAutonomousConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [executionData, setExecutionData] = useState<{
    execution: Execution | null;
    events: ExecutionEvent[];
  } | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  // Track whether sub-dialogs are open (to prevent Escape from closing parent)
  const hasSubDialogOpen =
    showBrainstormPanel ||
    showAutonomousConfirm ||
    showDiffModal ||
    showRollbackModal;
  const [descriptionValue, setDescriptionValue] = useState(
    task.description || "",
  );

  // Sync description when task updates externally
  useEffect(() => {
    if (!editingDescription) {
      setDescriptionValue(task.description || "");
    }
  }, [task.description, editingDescription]);

  // Determine if execution tab should be shown
  const showExecutionTab =
    task.status === "done" ||
    task.status === "stuck" ||
    task.status === "executing" ||
    task.status === "review";

  // Error handling
  const {
    error: apiError,
    retryCountdown,
    isApiKeyError,
    clearError,
    handleAPIResponse,
  } = useAPIError();

  // Get current step index for workflow
  const currentStepIndex = workflowSteps.indexOf(task.status);
  const isStuck = task.status === "stuck";
  const isEditable = task.status === "todo" || task.status === "stuck";

  const handleApiError = useCallback(
    async (res: Response) => {
      await handleAPIResponse(res);
    },
    [handleAPIResponse],
  );

  // Get status label for confirmation dialog
  const getStatusLabel = (status: TaskStatus): string => {
    const labels: Record<TaskStatus, string> = {
      todo: "To Do",
      brainstorming: "Brainstorming",
      planning: "Planning",
      ready: "Ready",
      executing: "Executing",
      review: "Review",
      done: "Done",
      stuck: "Failed",
    };
    return labels[status] || status;
  };

  const handleToggleAutonomous = async () => {
    // If enabling (not disabling) and not in "todo" status, show confirmation
    if (!autonomousMode && task.status !== "todo") {
      setShowAutonomousConfirm(true);
      return;
    }

    // For "todo" status or disabling, proceed directly
    await executeToggleAutonomous(false);
  };

  const executeToggleAutonomous = async (useResumeEndpoint: boolean) => {
    setTogglingAutonomous(true);
    try {
      let res: Response;

      if (useResumeEndpoint) {
        // Use the resume endpoint which enables autonomous mode and may auto-start execution
        res = await fetch(`/api/tasks/${task.id}/autonomous/resume`, {
          method: "POST",
        });
      } else {
        // Standard toggle via PATCH
        res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autonomousMode: !autonomousMode }),
        });
      }

      if (res.ok) {
        const updatedTask = await res.json();
        setAutonomousMode(updatedTask.autonomousMode);
        onUpdate(updatedTask);
      } else {
        await handleApiError(res);
      }
    } catch (err) {
      clientLogger.error("Error toggling autonomous mode", { error: err });
    } finally {
      setTogglingAutonomous(false);
    }
  };

  const handleConfirmAutonomous = async () => {
    setShowAutonomousConfirm(false);
    await executeToggleAutonomous(true);
  };

  const handleSaveField = useCallback(
    async (field: "title" | "description", value: string) => {
      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (res.ok) {
          const updatedTask = await res.json();
          onUpdate(updatedTask);
        }
      } catch (err) {
        clientLogger.error(`Failed to update task ${field}`, { error: err });
      }
    },
    [task.id, onUpdate],
  );

  const handleBrainstorm = useCallback(async () => {
    // Close modal immediately and trigger card's async flow
    if (onStart) {
      onClose();
      await onStart(task.id);
    } else {
      // Fallback to sync endpoint if no onStart callback (legacy behavior)
      setLoading(true);
      setActionType("brainstorm");
      clearError();
      try {
        const res = await fetch(`/api/tasks/${task.id}/brainstorm/generate`, {
          method: "POST",
        });
        if (res.ok) {
          const updatedTask = await res.json();
          onUpdate(updatedTask);
        } else {
          await handleApiError(res);
        }
      } catch (err) {
        clientLogger.error("Error brainstorming", { error: err });
      } finally {
        setLoading(false);
        setActionType(null);
      }
    }
  }, [task.id, clearError, onUpdate, handleApiError, onStart, onClose]);

  const handleRefine = () => {
    // Open interactive brainstorm panel for refinement
    setShowBrainstormPanel(true);
  };

  // Auto-start brainstorm when requested (calls API, doesn't open panel)
  useEffect(() => {
    if (autoStartBrainstorm && !autoStartTriggered && task.status === "todo") {
      setAutoStartTriggered(true);
      handleBrainstorm();
    }
  }, [autoStartBrainstorm, autoStartTriggered, task.status, handleBrainstorm]);

  // Fetch execution data when execution tab is selected or task has execution
  useEffect(() => {
    const fetchExecutionData = async () => {
      if (!showExecutionTab) return;
      if (activeTab !== "execution" && executionData !== null) return;
      if (executionLoading) return;

      setExecutionLoading(true);
      try {
        const res = await fetch(`/api/workers/${task.id}`);
        if (res.ok) {
          const data = await res.json();
          setExecutionData({
            execution: data.execution || null,
            events: data.events || [],
          });
        }
      } catch (error) {
        clientLogger.error("Error fetching execution data", { error });
      } finally {
        setExecutionLoading(false);
      }
    };

    // Fetch when tab becomes execution or when task becomes executable
    if (
      activeTab === "execution" ||
      (showExecutionTab && executionData === null)
    ) {
      fetchExecutionData();
    }
  }, [task.id, activeTab, showExecutionTab, executionData, executionLoading]);

  const handleBrainstormFinalize = async () => {
    // Refresh task data after brainstorm finishes
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      }
    } catch (error) {
      clientLogger.error("Error refreshing task", { error });
    }
  };

  const handlePlan = async () => {
    // Close modal immediately and trigger card's async flow
    if (onAdvance) {
      onClose();
      await onAdvance(task.id, "plan");
    } else {
      // Fallback to sync endpoint if no onAdvance callback (legacy behavior)
      setLoading(true);
      setActionType("plan");
      clearError();
      try {
        const res = await fetch(`/api/tasks/${task.id}/plan`, {
          method: "POST",
        });
        if (res.ok) {
          const updatedTask = await res.json();
          onUpdate(updatedTask);
        } else {
          await handleApiError(res);
        }
      } catch (err) {
        clientLogger.error("Error planning", { error: err });
      } finally {
        setLoading(false);
        setActionType(null);
      }
    }
  };

  const handleMarkReady = async () => {
    // Close modal immediately and trigger card's async flow
    if (onAdvance) {
      onClose();
      await onAdvance(task.id, "ready");
    } else {
      // Fallback to sync endpoint if no onAdvance callback (legacy behavior)
      setLoading(true);
      setActionType("ready");
      clearError();
      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ready" }),
        });
        if (res.ok) {
          const updatedTask = await res.json();
          onUpdate(updatedTask);
        } else {
          await handleApiError(res);
        }
      } catch (err) {
        clientLogger.error("Error marking ready", { error: err });
      } finally {
        setLoading(false);
        setActionType(null);
      }
    }
  };

  const handleStartExecution = async () => {
    // Close modal immediately and trigger card's async flow
    if (onAdvance) {
      onClose();
      await onAdvance(task.id, "execute");
    } else {
      // Fallback to sync endpoint if no onAdvance callback (legacy behavior)
      setLoading(true);
      setActionType("execute");
      clearError();
      try {
        const res = await fetch(`/api/tasks/${task.id}/execute`, {
          method: "POST",
        });
        if (res.ok) {
          const updatedTask = await res.json();
          onUpdate(updatedTask);
        } else {
          await handleApiError(res);
        }
      } catch (err) {
        clientLogger.error("Error starting execution", { error: err });
      } finally {
        setLoading(false);
        setActionType(null);
      }
    }
  };

  const handleDiffApprove = async () => {
    // Refresh task data after approval
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      }
    } catch (error) {
      clientLogger.error("Error refreshing task after approval", { error });
    }
  };

  const handleDiffReject = async () => {
    // Refresh task data after rejection
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      }
    } catch (error) {
      clientLogger.error("Error refreshing task after rejection", { error });
    }
  };

  const handleRollback = async () => {
    // Refresh task data after rollback
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      }
    } catch (error) {
      clientLogger.error("Error refreshing task after rollback", { error });
    }
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 outline-none"
          onEscapeKeyDown={(e) => {
            if (hasSubDialogOpen) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            // Prevent Radix default behavior since Content covers full screen
            e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
        >
          {/* Backdrop (click to close) */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Modal */}
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in duration-200">
            {/* Header */}
            <TaskHeader
              task={task}
              autonomousMode={autonomousMode}
              togglingAutonomous={togglingAutonomous}
              onToggleAutonomous={handleToggleAutonomous}
              onClose={onClose}
              onTitleSave={(title) => handleSaveField("title", title)}
            />

            {/* Tabs Navigation */}
            <TaskModalTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              showExecutionTab={showExecutionTab}
            />

            {/* Content - Scrollable */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Timeline Tab */}
              {activeTab === "timeline" && (
                <TimelineTab history={task.statusHistory || []} />
              )}

              {/* Execution Tab */}
              {activeTab === "execution" && showExecutionTab && (
                <div className="p-6">
                  {executionLoading && !executionData ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Loading execution details...
                      </span>
                    </div>
                  ) : executionData ? (
                    <ExecutionDetailTabs
                      task={task}
                      execution={executionData.execution}
                      events={executionData.events}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No execution data available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Details Tab */}
              {activeTab === "details" && (
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
                            Go to Settings
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
                        Workflow Progress
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
                                  isCompleted &&
                                    "bg-primary text-primary-foreground",
                                  isCurrent && [
                                    stepConfig.bgColor,
                                    stepConfig.color,
                                  ],
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
                                    index < currentStepIndex
                                      ? "bg-primary"
                                      : "bg-border",
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
                        Description
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
                          title={
                            isEditable ? "Click to edit description" : undefined
                          }
                        >
                          {task.description ||
                            "No description. Click to add one."}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Dependencies */}
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="w-4 h-4 text-slate-500 transition-transform duration-200 group-open:rotate-90" />
                      <h3 className="text-sm font-medium">Dependencies</h3>
                    </summary>
                    <div className="mt-3 p-4 bg-muted/30 rounded-xl border">
                      <DependencyEditor taskId={task.id} repoId={task.repoId} />
                    </div>
                  </details>

                  {/* Brainstorm Result */}
                  {task.brainstormResult &&
                    (() => {
                      const brainstorm = parseBrainstormResult(
                        task.brainstormResult,
                      );
                      if (!brainstorm) {
                        // Fallback to raw display if parsing fails
                        return (
                          <details className="group">
                            <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                              <ChevronRight className="w-4 h-4 text-violet-500 transition-transform duration-200 group-open:rotate-90" />
                              <Lightbulb className="w-4 h-4 text-violet-500" />
                              <h3 className="text-sm font-medium">
                                Brainstorm Result
                              </h3>
                            </summary>
                            <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30">
                              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                                {task.brainstormResult}
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
                              Brainstorm Result
                            </h3>
                          </summary>
                          <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30 space-y-4">
                            {/* Summary */}
                            <div>
                              <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
                                Summary
                              </h4>
                              <p className="text-sm leading-relaxed">
                                {brainstorm.summary}
                              </p>
                            </div>

                            {/* Requirements */}
                            {brainstorm.requirements.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
                                  Requirements
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {brainstorm.requirements.map((req, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-violet-500 mt-1">
                                        •
                                      </span>
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
                                  Considerations
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {brainstorm.considerations.map((con, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-violet-500 mt-1">
                                        •
                                      </span>
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
                                  Suggested Approach
                                </h4>
                                <p className="text-sm leading-relaxed">
                                  {renderFormattedText(
                                    brainstorm.suggestedApproach,
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })()}

                  {/* Plan Content and Ready for Execution */}
                  <TaskPlan
                    task={task}
                    loading={loading}
                    actionType={actionType}
                    onPlan={handlePlan}
                  />

                  {/* Execution Summary - shown for done/stuck tasks */}
                  {(task.status === "done" || task.status === "stuck") && (
                    <details className="group" open>
                      <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 transition-transform duration-200 group-open:rotate-90",
                            task.status === "done"
                              ? "text-emerald-500"
                              : "text-red-500",
                          )}
                        />
                        {task.status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <h3 className="text-sm font-medium">
                          Execution Summary
                        </h3>
                      </summary>
                      <div
                        className={cn(
                          "mt-3 p-4 rounded-xl border space-y-4",
                          task.status === "done"
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/30"
                            : "bg-red-50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/30",
                        )}
                      >
                        {/* Status */}
                        <div className="flex items-start gap-3">
                          {task.status === "done" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <h4
                              className={cn(
                                "text-xs font-semibold uppercase tracking-wide mb-1",
                                task.status === "done"
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-red-700 dark:text-red-300",
                              )}
                            >
                              Status
                            </h4>
                            <p className="text-sm font-medium">
                              {task.status === "done"
                                ? "Execution completed successfully"
                                : "Execution encountered issues"}
                            </p>
                          </div>
                        </div>

                        {/* PR Link - shown for done tasks with PR */}
                        {task.status === "done" && task.prUrl && (
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
                                task.status === "done"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400",
                              )}
                            />
                            <div>
                              <h4
                                className={cn(
                                  "text-xs font-semibold uppercase tracking-wide mb-1",
                                  task.status === "done"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-red-700 dark:text-red-300",
                                )}
                              >
                                Branch
                              </h4>
                              <code
                                className={cn(
                                  "text-sm font-mono px-2 py-0.5 rounded",
                                  task.status === "done"
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
                  )}

                  {/* Updated timestamp */}
                  {task.updatedAt && (
                    <div className="text-xs text-muted-foreground">
                      Last updated{" "}
                      {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <TaskActions
              task={task}
              loading={loading}
              actionType={actionType}
              autonomousMode={autonomousMode}
              onBrainstorm={handleBrainstorm}
              onRefine={handleRefine}
              onPlan={handlePlan}
              onMarkReady={handleMarkReady}
              onStartExecution={handleStartExecution}
              onReviewChanges={() => setShowDiffModal(true)}
              onShowRollback={() => setShowRollbackModal(true)}
            />
          </div>

          {/* Brainstorm Panel */}
          {showBrainstormPanel && (
            <BrainstormPanel
              taskId={task.id}
              taskTitle={task.title}
              isOpen={showBrainstormPanel}
              onClose={() => setShowBrainstormPanel(false)}
              onFinalize={handleBrainstormFinalize}
              onSave={onUpdate}
            />
          )}

          {/* Error Dialog - for errors with actions (rate limit, auth, etc.) */}
          {apiError && apiError.action && (
            <ErrorDialog
              open={!!apiError}
              onClose={clearError}
              title={apiError.code === "RATE_LIMIT" ? "Rate Limited" : "Error"}
              description={apiError.message}
              isApiKeyError={isApiKeyError}
              retryCountdown={retryCountdown}
              errorAction={apiError.action}
            />
          )}

          {/* Autonomous Mode Confirmation Dialog */}
          <ConfirmDialog
            open={showAutonomousConfirm}
            onOpenChange={setShowAutonomousConfirm}
            title="Enable Autonomous Mode?"
            description={`This task is at the "${getStatusLabel(task.status)}" stage. Enabling autonomous mode will automatically continue to the next stage${task.status === "ready" ? " and start execution immediately" : ""}.`}
            confirmLabel="Enable & Continue"
            cancelLabel="Cancel"
            onConfirm={handleConfirmAutonomous}
          />

          {/* Diff Review Modal */}
          <DiffModal
            taskId={task.id}
            isOpen={showDiffModal}
            onClose={() => setShowDiffModal(false)}
            onApprove={handleDiffApprove}
            onReject={handleDiffReject}
            onRequestChanges={handleDiffReject}
          />

          {/* Rollback Modal */}
          <RollbackModal
            taskId={task.id}
            isOpen={showRollbackModal}
            onClose={() => setShowRollbackModal(false)}
            onRollback={handleRollback}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
