import { useEffect, useRef } from "react";

export interface RepositoryEventHandlers {
  onTaskStatusChanged?: (data: {
    taskId: string;
    oldStatus: string;
    newStatus: string;
  }) => void;
  onTaskUpdated?: (data: {
    taskId: string;
    changes: Record<string, unknown>;
  }) => void;
  onExecutionStepCompleted?: (data: {
    taskId: string;
    stepId: string;
    status: string;
  }) => void;
  onDependencyChanged?: (data: {
    taskId: string;
    dependencies: { blockedBy: string[]; blocks: string[] };
  }) => void;
}

/**
 * Hook for subscribing to real-time repository events via Server-Sent Events (SSE)
 * Currently returns a no-op implementation since SSE endpoint is not yet implemented
 *
 * TODO: Implement SSE endpoint at /api/repos/[id]/events
 */
export function useRepositoryEvents(
  repositoryId: string,
  handlers: RepositoryEventHandlers,
) {
  const handlersRef = useRef(handlers);

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    // TODO: Implement SSE connection when endpoint is ready
    // For now, we'll use polling as a fallback
    // Uncomment when SSE endpoint is implemented:
    /*
    const eventSource = new EventSource(`/api/repos/${repositoryId}/events`);

    eventSource.addEventListener("task.status_changed", (event) => {
      const data = JSON.parse(event.data);
      handlersRef.current.onTaskStatusChanged?.(data);
    });

    eventSource.addEventListener("task.updated", (event) => {
      const data = JSON.parse(event.data);
      handlersRef.current.onTaskUpdated?.(data);
    });

    eventSource.addEventListener("execution.step_completed", (event) => {
      const data = JSON.parse(event.data);
      handlersRef.current.onExecutionStepCompleted?.(data);
    });

    eventSource.addEventListener("dependency.changed", (event) => {
      const data = JSON.parse(event.data);
      handlersRef.current.onDependencyChanged?.(data);
    });

    eventSource.onerror = () => {
      eventSource.close();
      // Reconnect with exponential backoff
      setTimeout(() => {
        // Re-initialize
      }, 1000);
    };

    return () => {
      eventSource.close();
    };
    */
  }, [repositoryId]);
}
