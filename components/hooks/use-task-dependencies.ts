"use client";

import { useState, useEffect, useCallback } from "react";
import { clientLogger } from "@/lib/logger";
import type { Task, TaskDependency } from "@/lib/db/schema";

export interface TaskDependencyInfo {
  dependency: TaskDependency;
  task: Task;
}

export interface UseTaskDependenciesOptions {
  taskId: string;
  repoId: string;
}

export interface UseTaskDependenciesReturn {
  // Tasks blocking this task (dependencies)
  blockedBy: TaskDependencyInfo[];
  // Tasks blocked by this task (dependents)
  blocks: TaskDependencyInfo[];
  // Available tasks to add as dependencies
  availableTasks: Task[];

  // Task settings
  autoExecuteWhenUnblocked: boolean;
  dependencyPriority: number;

  // State
  isLoading: boolean;
  error: Error | null;

  // Actions
  addDependency: (blockedById: string) => Promise<boolean>;
  removeDependency: (blockedById: string) => Promise<boolean>;
  setAutoExecuteWhenUnblocked: (enabled: boolean) => Promise<boolean>;
  setDependencyPriority: (priority: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useTaskDependencies({
  taskId,
  repoId,
}: UseTaskDependenciesOptions): UseTaskDependenciesReturn {
  const [blockedBy, setBlockedBy] = useState<TaskDependencyInfo[]>([]);
  const [blocks, setBlocks] = useState<TaskDependencyInfo[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [autoExecuteWhenUnblocked, setAutoExecuteState] = useState(false);
  const [dependencyPriority, setDependencyPriorityState] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch dependencies
  const fetchDependencies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`);

      if (!res.ok) {
        throw new Error(`Failed to fetch dependencies: ${res.statusText}`);
      }

      const data = await res.json();

      setBlockedBy(data.blockedBy || []);
      setBlocks(data.blocks || []);
      setAvailableTasks(data.availableTasks || []);
      setAutoExecuteState(data.autoExecuteWhenUnblocked ?? false);
      setDependencyPriorityState(data.dependencyPriority ?? 0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      clientLogger.error("Error fetching task dependencies", { error: err });
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  // Add a dependency
  const addDependency = useCallback(
    async (blockedById: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedById }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to add dependency");
        }

        // Refresh to get updated state
        await fetchDependencies();
        return true;
      } catch (err) {
        clientLogger.error("Error adding dependency", { error: err });
        return false;
      }
    },
    [taskId, fetchDependencies],
  );

  // Remove a dependency
  const removeDependency = useCallback(
    async (blockedById: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedById }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to remove dependency");
        }

        // Refresh to get updated state
        await fetchDependencies();
        return true;
      } catch (err) {
        clientLogger.error("Error removing dependency", { error: err });
        return false;
      }
    },
    [taskId, fetchDependencies],
  );

  // Update auto-execute setting
  const setAutoExecuteWhenUnblocked = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoExecuteWhenUnblocked: enabled }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update setting");
        }

        setAutoExecuteState(enabled);
        return true;
      } catch (err) {
        clientLogger.error("Error updating auto-execute setting", {
          error: err,
        });
        return false;
      }
    },
    [taskId],
  );

  // Update dependency priority
  const setDependencyPriority = useCallback(
    async (priority: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencyPriority: priority }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update priority");
        }

        setDependencyPriorityState(priority);
        return true;
      } catch (err) {
        clientLogger.error("Error updating dependency priority", {
          error: err,
        });
        return false;
      }
    },
    [taskId],
  );

  return {
    blockedBy,
    blocks,
    availableTasks,
    autoExecuteWhenUnblocked,
    dependencyPriority,
    isLoading,
    error,
    addDependency,
    removeDependency,
    setAutoExecuteWhenUnblocked,
    setDependencyPriority,
    refresh: fetchDependencies,
  };
}
