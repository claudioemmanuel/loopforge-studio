/**
 * useCloneStatus Hook
 * Phase 2.2: Real-time clone status tracking
 */

"use client";

import { useState, useEffect } from "react";
import type { CloneStatus } from "@/lib/contexts/repository/infrastructure/clone-status";
import { subscribeToCloneStatus } from "@/lib/contexts/repository/infrastructure/clone-status";

interface CloneStatusState {
  status: CloneStatus;
  isCloning: boolean;
  isCompleted: boolean;
  isFailed: boolean;
}

/**
 * Hook to track clone status with real-time updates
 * Polls the API for status updates during cloning operations
 */
export function useCloneStatus(
  repoId: string,
  initialStatus: CloneStatus = "pending",
): CloneStatusState {
  const [status, setStatus] = useState<CloneStatus>(initialStatus);

  // Subscribe to real-time events
  useEffect(() => {
    if (!repoId) return;

    const unsubscribe = subscribeToCloneStatus(repoId, (event) => {
      setStatus(event.status);
    });

    return () => unsubscribe();
  }, [repoId]);

  // Fallback polling for reliability
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Continue polling until terminal state is reached
    if (status === "cloning" || status === "pending") {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/repos/${repoId}`);
          if (response.ok) {
            const data = await response.json();
            const newStatus = data.cloneStatus as CloneStatus;

            if (newStatus !== status) {
              setStatus(newStatus);
            }

            // Stop polling on terminal states
            if (newStatus === "completed" || newStatus === "failed") {
              if (intervalId) clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error("Failed to fetch clone status:", error);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [repoId, status]);

  return {
    status,
    isCloning: status === "cloning",
    isCompleted: status === "completed",
    isFailed: status === "failed",
  };
}
