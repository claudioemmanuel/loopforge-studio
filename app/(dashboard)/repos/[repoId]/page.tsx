"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { clientLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { KanbanBoard } from "@/components/kanban";
import { RepositoryGraphView } from "@/components/repository/repository-graph-view";
import { NewTaskModal } from "@/components/modals/new-task-modal";

const TaskModal = dynamic(
  () => import("@/components/modals/task-modal").then((mod) => mod.TaskModal),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="animate-pulse h-96 w-full max-w-4xl bg-muted rounded-lg" />
      </div>
    ),
  },
);
import { ErrorDialog } from "@/components/ui/error-dialog";
import { BackwardMoveDialog } from "@/components/ui/backward-move-dialog";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import {
  useCardProcessing,
  useSlideAnimation,
} from "@/components/hooks/use-card-processing";
import { RepoSetupOverlay } from "@/components/repo-setup";
import { ActivityPanel } from "@/components/activity-panel";
import type { Task, TaskStatus } from "@/lib/contexts/task/api";
import { useTaskActions } from "./use-task-actions";
import { RepoHeader } from "./repo-header";
import type {
  RepoData,
  ErrorDialogState,
  BackwardMoveDialogState,
  ActionDialogState,
} from "./use-task-actions";

export default function RepoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const repoId = params.repoId as string;
  const taskIdFromUrl = searchParams.get("task");

  const [repo, setRepo] = useState<RepoData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoStartBrainstorm, setAutoStartBrainstorm] = useState(false);
  const [view, setView] = useState<"kanban" | "graph">("kanban");

  // Error dialog state for task start failures
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>({
    open: false,
    title: "",
    description: "",
    isApiKeyError: false,
  });

  // Backward move dialog state
  const [backwardMoveDialog, setBackwardMoveDialog] =
    useState<BackwardMoveDialogState>({
      open: false,
      taskId: "",
      taskTitle: "",
      fromStatus: "todo",
      toStatus: "todo",
    });

  // Action confirmation dialog state (for forward moves to action columns)
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    taskId: "",
    taskTitle: "",
    fromStatus: "todo",
    toStatus: "todo",
    loading: false,
  });

  // Track previous task statuses to detect lane changes
  const prevTaskStatusesRef = useRef<Map<string, TaskStatus>>(new Map());

  // Ref to hold fetchData for use in callbacks (declared before hooks that use it)
  const fetchDataRef = useRef<((signal?: AbortSignal) => Promise<void>) | null>(
    null,
  );

  // Slide animation hook
  const { triggerSlide, slidingCards } = useSlideAnimation();

  // Card processing hook for async operations
  const { processingCards } = useCardProcessing({
    enabled: true,
    onProcessingComplete: useCallback(
      (state: { taskId: string; error?: string }) => {
        // Refresh task data when processing completes
        fetchDataRef.current?.();
        // Trigger slide animation for the completed card
        triggerSlide(state.taskId);
      },
      [triggerSlide],
    ),
    onProcessingError: useCallback(
      (state: { taskId: string; error?: string }) => {
        // Show error dialog
        setErrorDialog({
          open: true,
          title: "Processing Failed",
          description: state.error || "An error occurred during processing",
          isApiKeyError: state.error?.includes("API key") || false,
        });
        // Refresh task data
        fetchDataRef.current?.();
      },
      [],
    ),
  });

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const fetchOptions = signal ? { signal } : {};
        const [repoRes, tasksRes] = await Promise.all([
          fetch(`/api/repos/${repoId}`, fetchOptions),
          fetch(`/api/repos/${repoId}/tasks`, fetchOptions),
        ]);

        // Check if aborted before processing results
        if (signal?.aborted) return;

        if (repoRes.ok) {
          setRepo(await repoRes.json());
        }
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data.tasks || []);
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") return;
        clientLogger.error("Error fetching data", { error });
      } finally {
        // Only update loading state if not aborted
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [repoId],
  );

  // Keep ref updated
  fetchDataRef.current = fetchData;

  // Track task status changes to trigger slide animations
  useEffect(() => {
    const prevStatuses = prevTaskStatusesRef.current;

    tasks.forEach((task) => {
      const prevStatus = prevStatuses.get(task.id);
      if (prevStatus && prevStatus !== task.status) {
        // Task moved to a different lane - trigger slide animation
        triggerSlide(task.id);
      }
    });

    // Update the ref with current statuses
    const newStatuses = new Map<string, TaskStatus>();
    tasks.forEach((task) => {
      newStatuses.set(task.id, task.status);
    });
    prevTaskStatusesRef.current = newStatuses;
  }, [tasks, triggerSlide]);

  // Fetch data on mount and when repoId changes
  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    fetchData(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchData]);

  // Handle manual refresh
  useEffect(() => {
    if (refreshing) {
      const abortController = new AbortController();
      fetchData(abortController.signal);
      return () => {
        abortController.abort();
      };
    }
  }, [refreshing, fetchData]);

  // Auto-open task modal from URL query parameter (e.g., from Workers page "View details")
  useEffect(() => {
    if (taskIdFromUrl && tasks.length > 0 && !selectedTask) {
      const task = tasks.find((t) => t.id === taskIdFromUrl);
      if (task) {
        setSelectedTask(task);
        // Auto-open brainstorm panel for tasks in brainstorming status
        setAutoStartBrainstorm(task.status === "brainstorming");
        // Clear the URL param to avoid re-opening on refresh
        window.history.replaceState({}, "", `/repos/${repoId}`);
      }
    }
  }, [taskIdFromUrl, tasks, selectedTask, repoId]);

  // Calculate task stats
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) =>
      ["executing", "brainstorming", "planning", "ready"].includes(t.status),
    ).length;
    const completed = tasks.filter((t) => t.status === "done").length;
    const stuck = tasks.filter((t) => t.status === "stuck").length;

    return { total, inProgress, completed, stuck };
  }, [tasks]);

  const {
    handleTaskMove,
    handleBackwardMoveKeepData,
    handleBackwardMoveReset,
    handleActionConfirm,
    handleActionCancel,
    handleTaskClick,
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDelete,
    handleTaskStart,
    handleTaskAdvance,
  } = useTaskActions({
    tasks,
    setTasks,
    fetchData,
    setSelectedTask,
    setAutoStartBrainstorm,
    setErrorDialog,
    backwardMoveDialog,
    setBackwardMoveDialog,
    actionDialog,
    setActionDialog,
  });

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTaskCreatedAndClose = (task: Task) => {
    handleTaskCreated(task);
    setShowNewTask(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">Loading board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Page Header */}
      <RepoHeader
        repo={repo}
        taskStats={taskStats}
        refreshing={refreshing}
        view={view}
        onViewChange={setView}
        onRefresh={handleRefresh}
        onNewTask={() => {
          if (repo?.isCloned) {
            setShowNewTask(true);
          }
        }}
        onRepoUpdate={setRepo}
      />

      {/* Main Content - Kanban Board or Graph View */}
      <main
        className={cn(
          "flex-1 overflow-hidden relative transition-opacity duration-300",
          !repo?.isCloned && "opacity-40",
        )}
      >
        {view === "kanban" ? (
          <div className="h-full px-6 lg:px-8 py-6">
            <KanbanBoard
              tasks={tasks}
              onTaskMove={handleTaskMove}
              onTaskClick={handleTaskClick}
              onTaskDelete={handleTaskDelete}
              onTaskStart={handleTaskStart}
              onTaskAdvance={handleTaskAdvance}
              onAddTask={() => setShowNewTask(true)}
              processingCards={processingCards}
              slidingCards={slidingCards}
            />
          </div>
        ) : (
          <RepositoryGraphView repositoryId={repoId} />
        )}

        {/* Repo setup overlay (when not cloned) */}
        {repo && !repo.isCloned && (
          <RepoSetupOverlay
            repoId={repoId}
            repoName={repo.name}
            isCloned={repo.isCloned}
            onCloneComplete={fetchData}
          />
        )}
      </main>

      {/* Activity Panel (collapsible sidebar) */}
      <ActivityPanel repoId={repoId} />

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setSelectedTask(null);
            setAutoStartBrainstorm(false);
          }}
          onUpdate={handleTaskUpdated}
          autoStartBrainstorm={autoStartBrainstorm}
          onStart={handleTaskStart}
          onAdvance={handleTaskAdvance}
        />
      )}

      {/* New Task Modal */}
      {showNewTask && repo?.isCloned && (
        <NewTaskModal
          repoId={repoId}
          onClose={() => setShowNewTask(false)}
          onCreate={handleTaskCreatedAndClose}
        />
      )}

      {/* Error Dialog for task start failures */}
      <ErrorDialog
        open={errorDialog.open}
        onClose={() => setErrorDialog((prev) => ({ ...prev, open: false }))}
        title={errorDialog.title}
        description={errorDialog.description}
        isApiKeyError={errorDialog.isApiKeyError}
      />

      {/* Backward Move Confirmation Dialog */}
      <BackwardMoveDialog
        open={backwardMoveDialog.open}
        onOpenChange={(open) =>
          setBackwardMoveDialog((prev) => ({ ...prev, open }))
        }
        fromStatus={backwardMoveDialog.fromStatus}
        toStatus={backwardMoveDialog.toStatus}
        taskTitle={backwardMoveDialog.taskTitle}
        onKeepData={handleBackwardMoveKeepData}
        onReset={handleBackwardMoveReset}
      />

      {/* Action Confirmation Dialog (for forward moves to action columns) */}
      <ConfirmActionDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog((prev) => ({ ...prev, open }))}
        taskTitle={actionDialog.taskTitle}
        fromStatus={actionDialog.fromStatus}
        toStatus={actionDialog.toStatus}
        onConfirm={handleActionConfirm}
        onCancel={handleActionCancel}
        loading={actionDialog.loading}
      />
    </div>
  );
}
