"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ExecutionGraph } from "@/lib/execution/graph-types";

/**
 * SSE event types for execution updates
 */
interface ExecutionEvent {
  type:
    | "processing_start"
    | "processing_update"
    | "processing_complete"
    | "processing_error";
  taskId: string;
  phase?: string;
  progress?: number;
  status?: string;
  nodeId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook options
 */
interface UseGraphRealtimeOptions {
  taskId: string;
  executionGraph: ExecutionGraph | null;
  onGraphUpdate?: (graph: ExecutionGraph) => void;
  enabled?: boolean;
}

/**
 * Hook return type
 */
interface UseGraphRealtimeReturn {
  isConnected: boolean;
  lastUpdate: Date | null;
  updatedNodeIds: Set<string>;
}

/**
 * Custom hook for real-time graph updates via SSE
 */
export function useGraphRealtime({
  taskId,
  executionGraph,
  onGraphUpdate,
  enabled = true,
}: UseGraphRealtimeOptions): UseGraphRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updatedNodeIds, setUpdatedNodeIds] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  // Clear updated nodes after animation
  useEffect(() => {
    if (updatedNodeIds.size > 0) {
      const timeout = setTimeout(() => {
        setUpdatedNodeIds(new Set());
      }, 1000); // Clear after 1 second

      return () => clearTimeout(timeout);
    }
  }, [updatedNodeIds]);

  // Handle SSE events
  const handleEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const data: ExecutionEvent = JSON.parse(event.data);

        if (data.taskId !== taskId) return;
        if (!executionGraph) return;

        // Update graph based on event type
        const updatedGraph = { ...executionGraph };
        let nodeUpdated = false;
        const newUpdatedNodeIds = new Set(updatedNodeIds);

        // Find and update relevant nodes
        updatedGraph.nodes = executionGraph.nodes.map((node) => {
          // Match node by phase or metadata
          const isRelevantNode =
            (data.phase && node.id.includes(data.phase)) ||
            (data.nodeId && node.id === data.nodeId);

          if (!isRelevantNode) return node;

          nodeUpdated = true;
          newUpdatedNodeIds.add(node.id);

          // Update node based on event type
          switch (data.type) {
            case "processing_start":
              return {
                ...node,
                status: "in-progress" as const,
                metadata: {
                  ...node.metadata,
                  startedAt: new Date().toISOString(),
                },
              };

            case "processing_update":
              return {
                ...node,
                status: "in-progress" as const,
                metadata: {
                  ...node.metadata,
                  progress: data.progress,
                  ...data.metadata,
                },
              };

            case "processing_complete":
              return {
                ...node,
                status: "complete" as const,
                metadata: {
                  ...node.metadata,
                  completedAt: new Date().toISOString(),
                  duration: node.metadata.startedAt
                    ? new Date().getTime() -
                      new Date(node.metadata.startedAt).getTime()
                    : undefined,
                },
              };

            case "processing_error":
              return {
                ...node,
                status: "failed" as const,
                metadata: {
                  ...node.metadata,
                  errorMessage: data.metadata?.error as string,
                },
              };

            default:
              return node;
          }
        });

        // Update edge animations based on node status
        updatedGraph.edges = executionGraph.edges.map((edge) => {
          const targetNode = updatedGraph.nodes.find(
            (n) => n.id === edge.target,
          );
          const sourceNode = updatedGraph.nodes.find(
            (n) => n.id === edge.source,
          );

          const shouldAnimate =
            targetNode?.status === "in-progress" &&
            (sourceNode?.status === "complete" ||
              sourceNode?.status === "in-progress");

          return {
            ...edge,
            animated: shouldAnimate,
          };
        });

        if (nodeUpdated) {
          setLastUpdate(new Date());
          setUpdatedNodeIds(newUpdatedNodeIds);
          onGraphUpdate?.(updatedGraph);
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    },
    [taskId, executionGraph, onGraphUpdate, updatedNodeIds],
  );

  // Connect to SSE
  const connect = useCallback(() => {
    if (!enabled || !taskId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/workers/sse?taskId=${taskId}`);

      eventSource.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = handleEvent;

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();

        // Exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay =
            baseReconnectDelay * Math.pow(2, reconnectAttempts.current);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("Error connecting to SSE:", error);
      setIsConnected(false);
    }
  }, [enabled, taskId, handleEvent]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled && taskId) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect, enabled, taskId]);

  return {
    isConnected,
    lastUpdate,
    updatedNodeIds,
  };
}
