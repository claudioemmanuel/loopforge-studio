"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/kanban";
import { TaskModal } from "@/components/task-modal";
import { NewTaskModal } from "@/components/new-task-modal";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { cn } from "@/lib/utils";
import {
  Plus,
  GitBranch,
  ListTodo,
  CheckCircle2,
  Zap,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import type { Task, TaskStatus } from "@/lib/db/schema";

interface RepoData {
  id: string;
  name: string;
  fullName: string;
}

// Quick stats configuration
const statConfig = {
  total: { label: "Total", icon: ListTodo, color: "text-muted-foreground" },
  inProgress: { label: "In Progress", icon: Zap, color: "text-primary" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-emerald-500" },
  stuck: { label: "Stuck", icon: AlertTriangle, color: "text-red-500" },
};

export default function RepoPage() {
  const params = useParams();
  const repoId = params.repoId as string;

  const [repo, setRepo] = useState<RepoData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoStartBrainstorm, setAutoStartBrainstorm] = useState(false);

  // Error dialog state for task start failures
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    isApiKeyError: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    isApiKeyError: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const [repoRes, tasksRes] = await Promise.all([
        fetch(`/api/repos/${repoId}`),
        fetch(`/api/repos/${repoId}/tasks`),
      ]);

      if (repoRes.ok) {
        setRepo(await repoRes.json());
      }
      if (tasksRes.ok) {
        setTasks(await tasksRes.json());
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate task stats
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) =>
      ["executing", "brainstorming", "planning", "ready"].includes(t.status)
    ).length;
    const completed = tasks.filter((t) => t.status === "done").length;
    const stuck = tasks.filter((t) => t.status === "stuck").length;

    return { total, inProgress, completed, stuck };
  }, [tasks]);

  const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error("Error updating task:", error);
      fetchData(); // Revert on error
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // Auto-open brainstorm panel for tasks in brainstorming status
    setAutoStartBrainstorm(task.status === "brainstorming");
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [...prev, task]);
    setShowNewTask(false);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  const handleTaskDelete = async (taskId: string) => {
    // Optimistic update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        console.error("Failed to delete task");
        fetchData(); // Revert on error
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      fetchData(); // Revert on error
    }
  };

  const handleTaskStart = async (taskId: string) => {
    // Find the task and open the modal with auto-start brainstorm
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setAutoStartBrainstorm(true);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
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
      <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="px-6 lg:px-8 py-6">
          {/* Breadcrumb and actions row */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                <RefreshCw
                  className={cn("w-4 h-4", refreshing && "animate-spin")}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button onClick={() => setShowNewTask(true)} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </Button>
            </div>
          </div>

          {/* Title and description */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
                {repo?.name || "Repository"}
              </h1>
              {repo?.fullName && (
                <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                  <GitBranch className="w-4 h-4" />
                  <span className="text-sm font-mono">{repo.fullName}</span>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-4 sm:gap-6">
              {(Object.entries(taskStats) as [keyof typeof taskStats, number][]).map(
                ([key, value]) => {
                  const config = statConfig[key];
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", config.color)} />
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold tabular-nums">
                          {value}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {config.label}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="flex-1 overflow-hidden px-6 lg:px-8 py-6">
        <KanbanBoard
          tasks={tasks}
          onTaskMove={handleTaskMove}
          onTaskClick={handleTaskClick}
          onTaskDelete={handleTaskDelete}
          onTaskStart={handleTaskStart}
          onAddTask={() => setShowNewTask(true)}
        />
      </main>

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
        />
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <NewTaskModal
          repoId={repoId}
          onClose={() => setShowNewTask(false)}
          onCreate={handleTaskCreated}
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
    </div>
  );
}
