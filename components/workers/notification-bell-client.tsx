"use client";

import { useMemo } from "react";
import { NotificationBell, NotificationBellSkeleton, type WorkerNotification } from "./notification-bell";
import { useWorkerEvents, type WorkerEventData } from "@/components/hooks/use-worker-events";

interface NotificationBellClientProps {
  className?: string;
}

// Convert WorkerEventData to WorkerNotification format
function toWorkerNotification(worker: WorkerEventData): WorkerNotification {
  return {
    id: worker.taskId,
    taskId: worker.taskId,
    taskTitle: worker.taskTitle,
    repoName: worker.repoName,
    status: worker.status as WorkerNotification["status"],
    progress: worker.progress,
    currentStep: worker.currentStep,
    timestamp: new Date(worker.updatedAt),
    error: worker.error,
  };
}

/**
 * Client-side wrapper for NotificationBell that connects to SSE
 */
export function NotificationBellClient({ className }: NotificationBellClientProps) {
  const { workers, isConnected } = useWorkerEvents();

  const notifications = useMemo(() => {
    return workers.map(toWorkerNotification);
  }, [workers]);

  if (!isConnected && notifications.length === 0) {
    return <NotificationBellSkeleton className={className} />;
  }

  return <NotificationBell workers={notifications} className={className} />;
}
