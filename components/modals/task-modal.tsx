"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { clientLogger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
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
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { TaskModalTabs, TimelineTab, type TabId } from "./task-modal/";
import { TaskHeader } from "./task-modal/task-header";
import { TaskActions } from "./task-modal/task-actions";
import { workflowSteps } from "./task-modal/task-config";
import { DetailsTab } from "./task-modal/details-tab";
import { ExecutionDetailTabs } from "@/components/workers/execution-detail-tabs";
import { ExecutionGraph } from "@/components/execution/execution-graph";
import type { ExecutionGraph as ExecutionGraphType } from "@/lib/shared/graph-types";

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

export function TaskModal({
  task,
  onClose,
  onUpdate,
  autoStartBrainstorm = false,
  onStart,
  onAdvance,
}: TaskModalProps) {
  const t = useTranslations();
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
  const [executionGraph, setExecutionGraph] =
    useState<ExecutionGraphType | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Handle real-time graph updates
  const handleGraphUpdate = useCallback((updatedGraph: ExecutionGraphType) => {
    setExecutionGraph(updatedGraph);
  }, []);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(
    task.description || "",
  );

  // Track whether sub-dialogs are open (to prevent Escape from closing parent)
  const hasSubDialogOpen =
    showBrainstormPanel ||
    showAutonomousConfirm ||
    showDiffModal ||
    showRollbackModal;

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

  // Determine if graph tab should be shown
  const showGraphTab = showExecutionTab;

  // Error handling
  const {
    error: apiError,
    retryCountdown,
    isApiKeyError,
    clearError,
    handleAPIResponse,
  } = useAPIError();

  // Workflow state
  const currentStepIndex = workflowSteps.indexOf(task.status);
  const isStuck = task.status === "stuck";
  const isEditable = task.status === "todo" || task.status === "stuck";

  const handleApiError = useCallback(
    async (res: Response) => {
      await handleAPIResponse(res);
    },
    [handleAPIResponse],
  );

  // -------------------------------------------------------------------------
  // Status label helper
  // -------------------------------------------------------------------------
  const getStatusLabel = (status: TaskStatus): string => {
    const labels: Record<TaskStatus, string> = {
      todo: t("tasks.statuses.todo"),
      brainstorming: t("tasks.statuses.brainstorming"),
      planning: t("tasks.statuses.planning"),
      ready: t("tasks.statuses.ready"),
      executing: t("tasks.statuses.executing"),
      review: t("tasks.statuses.review"),
      done: t("tasks.statuses.done"),
      stuck: t("tasks.statuses.stuck"),
    };
    return labels[status] || status;
  };

  // -------------------------------------------------------------------------
  // Autonomous mode handlers
  // -------------------------------------------------------------------------
  const handleToggleAutonomous = async () => {
    if (!autonomousMode && task.status !== "todo") {
      setShowAutonomousConfirm(true);
      return;
    }
    await executeToggleAutonomous(false);
  };

  const executeToggleAutonomous = async (useResumeEndpoint: boolean) => {
    setTogglingAutonomous(true);
    try {
      let res: Response;
      if (useResumeEndpoint) {
        res = await fetch(`/api/tasks/${task.id}/autonomous/resume`, {
          method: "POST",
        });
      } else {
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

  // -------------------------------------------------------------------------
  // Field editing
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Phase action handlers
  // -------------------------------------------------------------------------
  const handleBrainstorm = useCallback(async () => {
    if (onStart) {
      onClose();
      await onStart(task.id);
    } else {
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
    setShowBrainstormPanel(true);
  };

  // Auto-start brainstorm when requested
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

    if (
      activeTab === "execution" ||
      (showExecutionTab && executionData === null)
    ) {
      fetchExecutionData();
    }
  }, [task.id, activeTab, showExecutionTab, executionData, executionLoading]);

  // Fetch execution graph when graph tab is selected
  useEffect(() => {
    const fetchGraphData = async () => {
      if (!showGraphTab) return;
      if (activeTab !== "graph" && executionGraph !== null) return;
      if (graphLoading) return;

      setGraphLoading(true);
      try {
        const res = await fetch(`/api/tasks/${task.id}?include=graph`);
        if (res.ok) {
          const data = await res.json();
          setExecutionGraph(data.executionGraph || null);
        }
      } catch (error) {
        clientLogger.error("Error fetching graph data", { error });
      } finally {
        setGraphLoading(false);
      }
    };

    if (activeTab === "graph" || (showGraphTab && executionGraph === null)) {
      fetchGraphData();
    }
  }, [task.id, activeTab, showGraphTab, executionGraph, graphLoading]);

  const handleBrainstormFinalize = async () => {
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
    if (onAdvance) {
      onClose();
      await onAdvance(task.id, "plan");
    } else {
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
    if (onAdvance) {
      onClose();
      await onAdvance(task.id, "ready");
    } else {
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
    if (onAdvance) {
      onClose();
      await onAdvance(task.id, "execute");
    } else {
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

  const refreshTask = async () => {
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
            e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
        >
          {/* Accessible title for screen readers */}
          <VisuallyHidden>
            <DialogPrimitive.Title>
              {t("tasks.modal.title")}
            </DialogPrimitive.Title>
          </VisuallyHidden>

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
              showGraphTab={showGraphTab}
            />

            {/* Content - Scrollable */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Timeline Tab */}
              {activeTab === "timeline" && (
                <TimelineTab history={task.statusHistory || []} />
              )}

              {/* Graph Tab */}
              {activeTab === "graph" && showGraphTab && (
                <div className="p-6">
                  {graphLoading && !executionGraph ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {t("tasks.modal.loadingGraph")}
                      </span>
                    </div>
                  ) : executionGraph ? (
                    <div className="h-[600px] rounded-lg border border-slate-700 overflow-hidden">
                      <ExecutionGraph
                        taskId={task.id}
                        executionGraph={executionGraph}
                        onGraphUpdate={handleGraphUpdate}
                        enableRealtime={task.status === "executing"}
                        showMinimap={true}
                        showLegend={true}
                        showControls={true}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>{t("tasks.modal.noGraphData")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Tab */}
              {activeTab === "execution" && showExecutionTab && (
                <div className="p-6">
                  {executionLoading && !executionData ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {t("tasks.modal.loadingExecution")}
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
                      <p>{t("tasks.modal.noExecutionData")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Details Tab */}
              {activeTab === "details" && (
                <DetailsTab
                  task={task}
                  apiError={apiError}
                  isApiKeyError={isApiKeyError}
                  clearError={clearError}
                  loading={loading}
                  actionType={actionType}
                  isStuck={isStuck}
                  isEditable={isEditable}
                  currentStepIndex={currentStepIndex}
                  editingDescription={editingDescription}
                  setEditingDescription={setEditingDescription}
                  descriptionValue={descriptionValue}
                  setDescriptionValue={setDescriptionValue}
                  handleSaveField={handleSaveField}
                  handlePlan={handlePlan}
                />
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
              title={
                apiError.code === "RATE_LIMIT"
                  ? t("errors.rateLimit")
                  : t("errors.error")
              }
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
            onApprove={refreshTask}
            onReject={refreshTask}
            onRequestChanges={refreshTask}
          />

          {/* Rollback Modal */}
          <RollbackModal
            taskId={task.id}
            isOpen={showRollbackModal}
            onClose={() => setShowRollbackModal(false)}
            onRollback={refreshTask}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
