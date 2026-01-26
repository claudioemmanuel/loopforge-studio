"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ProcessingPhase } from "@/lib/db/schema";
import { clientLogger } from "@/lib/logger";

export interface CardProcessingState {
  taskId: string;
  taskTitle: string;
  repoName: string;
  processingPhase: ProcessingPhase;
  statusText: string;
  progress: number;
  jobId: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface ProcessingEvent {
  type:
    | "processing_start"
    | "processing_update"
    | "processing_complete"
    | "processing_error";
  data: CardProcessingState;
  timestamp: string;
}

interface UseCardProcessingOptions {
  enabled?: boolean;
  onProcessingComplete?: (state: CardProcessingState) => void;
  onProcessingError?: (state: CardProcessingState) => void;
}

interface UseCardProcessingReturn {
  processingCards: Map<string, CardProcessingState>;
  isConnected: boolean;
  error: string | null;
  isProcessing: (taskId: string) => boolean;
  getProcessingState: (taskId: string) => CardProcessingState | undefined;
}

export function useCardProcessing(
  options: UseCardProcessingOptions = {},
): UseCardProcessingReturn {
  const { enabled = true, onProcessingComplete, onProcessingError } = options;

  const [processingCards, setProcessingCards] = useState<
    Map<string, CardProcessingState>
  >(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Prevent duplicate connections (Strict Mode protection)
    if (
      isConnecting.current ||
      eventSourceRef.current?.readyState === EventSource.OPEN
    ) {
      return;
    }
    isConnecting.current = true;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Use the same SSE endpoint, but filter for processing events
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
        const workerEvent = JSON.parse(event.data);

        // Handle processing-specific events
        if (workerEvent.type?.startsWith("processing_")) {
          const processingEvent = workerEvent as ProcessingEvent;
          const { data } = processingEvent;

          switch (processingEvent.type) {
            case "processing_start":
            case "processing_update":
              setProcessingCards((prev) => {
                const updated = new Map(prev);
                updated.set(data.taskId, data);
                return updated;
              });
              break;

            case "processing_complete":
              setProcessingCards((prev) => {
                const updated = new Map(prev);
                updated.delete(data.taskId);
                return updated;
              });
              onProcessingComplete?.(data);
              break;

            case "processing_error":
              setProcessingCards((prev) => {
                const updated = new Map(prev);
                updated.delete(data.taskId);
                return updated;
              });
              onProcessingError?.(data);
              break;
          }
        }

        // Also handle worker events that indicate processing state
        if (workerEvent.type === "worker_list") {
          // Initial load - check for any tasks in processing state
          const workers = workerEvent.data as Array<{
            taskId: string;
            taskTitle: string;
            repoName: string;
            status: string;
            progress: number;
            currentAction?: string;
            updatedAt: string;
          }>;

          const processingTasks = new Map<string, CardProcessingState>();

          for (const worker of workers) {
            // Check if task is in an active processing phase
            if (
              ["brainstorming", "planning", "executing"].includes(worker.status)
            ) {
              processingTasks.set(worker.taskId, {
                taskId: worker.taskId,
                taskTitle: worker.taskTitle,
                repoName: worker.repoName,
                processingPhase: worker.status as ProcessingPhase,
                statusText: worker.currentAction || `${worker.status}...`,
                progress: worker.progress,
                jobId: "", // Not available from worker list
                startedAt: worker.updatedAt,
                updatedAt: worker.updatedAt,
              });
            }
          }

          if (processingTasks.size > 0) {
            setProcessingCards(processingTasks);
          }
        }
      } catch (err) {
        clientLogger.error("Failed to parse event", { error: err });
      }
    };

    eventSource.onerror = () => {
      isConnecting.current = false;
      setIsConnected(false);
      eventSource.close();

      // Exponential backoff reconnection
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current),
        30000,
      );
      reconnectAttempts.current++;

      if (reconnectAttempts.current <= 5) {
        setError("Connection lost. Reconnecting...");
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setError("Unable to connect. Please refresh the page.");
      }
    };
  }, [enabled, onProcessingComplete, onProcessingError]);

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

  const isProcessing = useCallback(
    (taskId: string) => processingCards.has(taskId),
    [processingCards],
  );

  const getProcessingState = useCallback(
    (taskId: string) => processingCards.get(taskId),
    [processingCards],
  );

  return {
    processingCards,
    isConnected,
    error,
    isProcessing,
    getProcessingState,
  };
}

// Hook to track slide animation for cards that just changed lanes
export function useSlideAnimation() {
  const [slidingCards, setSlidingCards] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const triggerSlide = useCallback((taskId: string) => {
    // Clear any existing timeout for this card
    const existingTimeout = timeoutsRef.current.get(taskId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Add to sliding cards
    setSlidingCards((prev) => new Set(prev).add(taskId));

    // Remove after animation completes (400ms)
    const timeout = setTimeout(() => {
      setSlidingCards((prev) => {
        const updated = new Set(prev);
        updated.delete(taskId);
        return updated;
      });
      timeoutsRef.current.delete(taskId);
    }, 400);

    timeoutsRef.current.set(taskId, timeout);
  }, []);

  const isSliding = useCallback(
    (taskId: string) => slidingCards.has(taskId),
    [slidingCards],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    triggerSlide,
    isSliding,
    slidingCards,
  };
}
