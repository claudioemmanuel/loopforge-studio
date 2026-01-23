"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TaskStatus } from "@/lib/db/schema";

export interface WorkerEventData {
  taskId: string;
  taskTitle: string;
  repoId: string;
  repoName: string;
  status: TaskStatus;
  progress: number;
  currentStep?: string;
  currentAction?: string;
  error?: string;
  completedAt?: string;
  updatedAt: string;
  autonomousMode?: boolean;
}

export interface WorkerEvent {
  type: "worker_update" | "worker_complete" | "worker_stuck" | "worker_list";
  data: WorkerEventData | WorkerEventData[];
  timestamp: string;
}

interface UseWorkerEventsOptions {
  enabled?: boolean;
  onWorkerComplete?: (worker: WorkerEventData) => void;
  onWorkerStuck?: (worker: WorkerEventData) => void;
}

interface UseWorkerEventsReturn {
  workers: WorkerEventData[];
  activeCount: number;
  stuckCount: number;
  hasStuck: boolean;
  isConnected: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWorkerEvents(
  options: UseWorkerEventsOptions = {}
): UseWorkerEventsReturn {
  const { enabled = true, onWorkerComplete, onWorkerStuck } = options;

  const [workers, setWorkers] = useState<WorkerEventData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Prevent duplicate connections (Strict Mode protection)
    if (isConnecting.current || (eventSourceRef.current?.readyState === EventSource.OPEN)) {
      return;
    }
    isConnecting.current = true;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource("/api/workers/sse");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      isConnecting.current = false;
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const workerEvent: WorkerEvent = JSON.parse(event.data);

        // Helper to ensure worker data has required fields with defaults
        const normalizeWorkerData = (data: WorkerEventData): WorkerEventData => ({
          ...data,
          taskTitle: data.taskTitle || "Processing...",
          repoName: data.repoName || "Unknown",
          progress: data.progress ?? 0,
          currentAction: data.currentAction || getDefaultStatusText(data.status),
        });

        // Helper to get default status text
        function getDefaultStatusText(status: TaskStatus): string {
          switch (status) {
            case "brainstorming": return "Starting brainstorm...";
            case "planning": return "Starting plan generation...";
            case "executing": return "Starting execution...";
            default: return undefined as unknown as string;
          }
        }

        switch (workerEvent.type) {
          case "worker_list":
            // Initial list of workers - normalize data to ensure required fields
            const normalizedList = (workerEvent.data as WorkerEventData[]).map(normalizeWorkerData);
            setWorkers(normalizedList);
            break;

          case "worker_update":
            // Update a single worker - normalize data
            const updateData = normalizeWorkerData(workerEvent.data as WorkerEventData);
            setWorkers((prev) => {
              const index = prev.findIndex((w) => w.taskId === updateData.taskId);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = updateData;
                return updated;
              }
              // New worker, add to front
              return [updateData, ...prev];
            });
            break;

          case "worker_complete":
            const completeData = normalizeWorkerData(workerEvent.data as WorkerEventData);
            setWorkers((prev) =>
              prev.map((w) =>
                w.taskId === completeData.taskId ? completeData : w
              )
            );
            onWorkerComplete?.(completeData);
            break;

          case "worker_stuck":
            const stuckData = normalizeWorkerData(workerEvent.data as WorkerEventData);
            setWorkers((prev) =>
              prev.map((w) =>
                w.taskId === stuckData.taskId ? stuckData : w
              )
            );
            onWorkerStuck?.(stuckData);
            break;
        }
      } catch (err) {
        console.error("Failed to parse worker event:", err);
      }
    };

    eventSource.onerror = () => {
      isConnecting.current = false;
      setIsConnected(false);
      eventSource.close();

      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;

      if (reconnectAttempts.current <= 5) {
        setError("Connection lost. Reconnecting...");
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setError("Unable to connect to worker events. Please refresh the page.");
      }
    };
  }, [enabled, onWorkerComplete, onWorkerStuck]);

  const refresh = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      isConnecting.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const activeCount = workers.filter((w) =>
    ["brainstorming", "planning", "ready", "executing"].includes(w.status)
  ).length;

  const stuckCount = workers.filter((w) => w.status === "stuck").length;

  return {
    workers,
    activeCount,
    stuckCount,
    hasStuck: stuckCount > 0,
    isConnected,
    error,
    refresh,
  };
}

// Calculate progress percentage from status
export function calculateProgress(
  status: TaskStatus,
  currentStep?: string
): number {
  const progressMap: Record<TaskStatus, number> = {
    todo: 0,
    brainstorming: 20,
    planning: 40,
    ready: 60,
    executing: 80,
    done: 100,
    stuck: 0, // Frozen at last known progress
  };

  if (status === "executing" && currentStep) {
    // Parse "Step 3/6" to get more granular progress
    const match = currentStep.match(/Step (\d+)\/(\d+)/);
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      return 60 + (current / total) * 40;
    }
  }

  return progressMap[status] ?? 0;
}
