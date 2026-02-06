"use client";

import { clientLogger } from "@/lib/logger";
import { isBackwardMove } from "@/components/ui/backward-move-dialog";
import { requiresActionConfirmation } from "@/components/ui/confirm-action-dialog";
import { ListTodo, CheckCircle2, Zap, AlertTriangle } from "lucide-react";
import type { Task, TaskStatus } from "@/lib/contexts/task/api";
import type { IndexingStatus } from "@/lib/contexts/repository/api";

export interface RepoData {
  id: string;
  name: string;
  fullName: string;
  isCloned: boolean;
  indexingStatus: IndexingStatus;
  autoApprove?: boolean;
}

// Quick stats configuration
export const statConfig = {
  total: { label: "Total", icon: ListTodo, color: "text-muted-foreground" },
  inProgress: { label: "In Progress", icon: Zap, color: "text-primary" },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  stuck: { label: "Failed", icon: AlertTriangle, color: "text-red-500" },
};

export interface ErrorDialogState {
  open: boolean;
  title: string;
  description: string;
  isApiKeyError: boolean;
}

export interface BackwardMoveDialogState {
  open: boolean;
  taskId: string;
  taskTitle: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
}

export interface ActionDialogState {
  open: boolean;
  taskId: string;
  taskTitle: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  loading: boolean;
}

interface UseTaskActionsParams {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  fetchData: (signal?: AbortSignal) => Promise<void>;
  setSelectedTask: React.Dispatch<React.SetStateAction<Task | null>>;
  setAutoStartBrainstorm: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorDialog: React.Dispatch<React.SetStateAction<ErrorDialogState>>;
  backwardMoveDialog: BackwardMoveDialogState;
  setBackwardMoveDialog: React.Dispatch<
    React.SetStateAction<BackwardMoveDialogState>
  >;
  actionDialog: ActionDialogState;
  setActionDialog: React.Dispatch<React.SetStateAction<ActionDialogState>>;
}

export function useTaskActions({
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
}: UseTaskActionsParams) {
  // Core function to perform the task move API call
  const performTaskMove = async (
    taskId: string,
    newStatus: TaskStatus,
    resetPhases: boolean = false,
  ) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, resetPhases }),
      });

      if (!res.ok) {
        // Revert to original status
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: currentTask.status } : t,
          ),
        );

        const errorData = await res.json().catch(() => ({}));
        setErrorDialog({
          open: true,
          title: newStatus === "executing" ? "Execution Failed" : "Move Failed",
          description: errorData.error || `Failed to move task to ${newStatus}`,
          isApiKeyError:
            errorData.error?.includes("API key") ||
            errorData.code === "NO_PROVIDER_CONFIGURED",
        });
      } else {
        // Update with server response (includes execution info when moving to executing)
        const updatedTask = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        );
      }
    } catch (error) {
      clientLogger.error("Error updating task", { error, taskId });
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: currentTask.status } : t,
        ),
      );
    }
  };

  const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    // Find the current task for potential revert
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    // Check if this is a backward move
    if (isBackwardMove(currentTask.status, newStatus)) {
      // Show confirmation dialog instead of moving immediately
      setBackwardMoveDialog({
        open: true,
        taskId,
        taskTitle: currentTask.title,
        fromStatus: currentTask.status,
        toStatus: newStatus,
      });
      return;
    }

    // Check if forward move requires action confirmation
    if (requiresActionConfirmation(newStatus)) {
      setActionDialog({
        open: true,
        taskId,
        taskTitle: currentTask.title,
        fromStatus: currentTask.status,
        toStatus: newStatus,
        loading: false,
      });
      return;
    }

    // Simple status update (ready, done, stuck) - proceed immediately
    await performTaskMove(taskId, newStatus);
  };

  // Handler for backward move with data preserved
  const handleBackwardMoveKeepData = async () => {
    const { taskId, toStatus } = backwardMoveDialog;
    await performTaskMove(taskId, toStatus, false);
  };

  // Handler for backward move with data reset
  const handleBackwardMoveReset = async () => {
    const { taskId, toStatus } = backwardMoveDialog;
    await performTaskMove(taskId, toStatus, true);
  };

  // Handler for action dialog confirmation
  const handleActionConfirm = async () => {
    const { taskId, toStatus } = actionDialog;

    setActionDialog((prev) => ({ ...prev, loading: true }));

    try {
      if (toStatus === "brainstorming") {
        await executeStartAction(taskId);
      } else if (toStatus === "planning") {
        await executeAdvanceAction(taskId, "plan");
      } else if (toStatus === "executing") {
        await executeAdvanceAction(taskId, "execute");
      }
    } finally {
      setActionDialog((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  // Handler for action dialog cancel
  const handleActionCancel = () => {
    setActionDialog((prev) => ({ ...prev, open: false, loading: false }));
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // Auto-open brainstorm panel for tasks in brainstorming status
    setAutoStartBrainstorm(task.status === "brainstorming");
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [...prev, task]);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    );
    setSelectedTask(updatedTask);
  };

  const handleTaskDelete = async (taskId: string) => {
    // Optimistic update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        clientLogger.error("Failed to delete task", { taskId });
        fetchData(); // Revert on error
      }
    } catch (error) {
      clientLogger.error("Error deleting task", { error, taskId });
      fetchData(); // Revert on error
    }
  };

  // Internal execution functions (no confirmation, called after user confirms)
  const executeStartAction = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/start`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setErrorDialog({
          open: true,
          title: "Failed to Start",
          description: errorData.error || "Failed to start brainstorming",
          isApiKeyError:
            errorData.error?.includes("API key") ||
            errorData.code === "NO_PROVIDER_CONFIGURED",
        });
        return;
      }

      // Optimistically update task status
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "brainstorming" as TaskStatus } : t,
        ),
      );
    } catch (error) {
      clientLogger.error("Error starting brainstorm", { error, taskId });
      setErrorDialog({
        open: true,
        title: "Failed to Start",
        description: "An unexpected error occurred",
        isApiKeyError: false,
      });
    }
  };

  const executeAdvanceAction = async (
    taskId: string,
    action: "plan" | "ready" | "execute",
  ) => {
    // For plan action, use async endpoint (card locks immediately)
    if (action === "plan") {
      try {
        const res = await fetch(`/api/tasks/${taskId}/plan/start`, {
          method: "POST",
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          setErrorDialog({
            open: true,
            title: "Failed to Start Planning",
            description: errorData.error || "Failed to start planning",
            isApiKeyError:
              errorData.error?.includes("API key") ||
              errorData.code === "NO_PROVIDER_CONFIGURED",
          });
          return;
        }

        // Optimistically update task status
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "planning" as TaskStatus } : t,
          ),
        );
        return;
      } catch (error) {
        clientLogger.error("Error starting plan", { error, taskId });
        setErrorDialog({
          open: true,
          title: "Failed to Start Planning",
          description: "An unexpected error occurred",
          isApiKeyError: false,
        });
        return;
      }
    }

    // For ready and execute actions, use existing synchronous endpoints
    const endpoint =
      action === "ready"
        ? `/api/tasks/${taskId}`
        : `/api/tasks/${taskId}/execute`;

    const method = action === "ready" ? "PATCH" : "POST";
    const body =
      action === "ready" ? JSON.stringify({ status: "ready" }) : undefined;

    try {
      const res = await fetch(endpoint, {
        method,
        body,
        headers: body ? { "Content-Type": "application/json" } : undefined,
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrorDialog({
          open: true,
          title: "Action Failed",
          description: errorData.error || `Failed to ${action} task`,
          isApiKeyError: errorData.error?.includes("API key"),
        });
      }
    } catch (error) {
      clientLogger.error("Error advancing task", { error, taskId, action });
      setErrorDialog({
        open: true,
        title: "Action Failed",
        description: "An unexpected error occurred",
        isApiKeyError: false,
      });
    }
  };

  // Public handlers that show confirmation before executing actions
  const handleTaskStart = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // For non-todo tasks, just open the modal
    if (task.status !== "todo") {
      setSelectedTask(task);
      setAutoStartBrainstorm(task.status === "brainstorming");
      return;
    }

    // Show confirmation dialog for starting brainstorming
    setActionDialog({
      open: true,
      taskId,
      taskTitle: task.title,
      fromStatus: task.status,
      toStatus: "brainstorming",
      loading: false,
    });
  };

  const handleTaskAdvance = async (
    taskId: string,
    action: "plan" | "ready" | "execute",
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // "ready" doesn't need confirmation - it's not an AI action
    if (action === "ready") {
      await executeAdvanceAction(taskId, action);
      return;
    }

    // Show confirmation for "plan" and "execute"
    const targetStatus: TaskStatus =
      action === "plan" ? "planning" : "executing";
    setActionDialog({
      open: true,
      taskId,
      taskTitle: task.title,
      fromStatus: task.status,
      toStatus: targetStatus,
      loading: false,
    });
  };

  return {
    performTaskMove,
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
  };
}
