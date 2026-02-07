"use client";

import { useCallback, useEffect, useState } from "react";

const HEALTH_POLL_INTERVAL_MS = 30_000;
const HEALTH_BACKLOG_THRESHOLD = 10;

type WorkerRuntimeStatus = "running" | "stopped" | "error";

export interface WorkerHealthStatusSnapshot {
  worker: {
    status: WorkerRuntimeStatus;
  };
  redis: {
    connected: boolean;
  };
  queues: {
    brainstorm: { waiting: number };
    plan: { waiting: number };
    execution: { waiting: number };
  };
  stuck: {
    count: number;
  };
}

export function isWorkerHealthUnhealthy(
  health: WorkerHealthStatusSnapshot,
): boolean {
  if (health.worker.status === "stopped" || health.worker.status === "error") {
    return true;
  }

  if (!health.redis.connected) {
    return true;
  }

  const totalWaiting =
    health.queues.brainstorm.waiting +
    health.queues.plan.waiting +
    health.queues.execution.waiting;

  if (totalWaiting > HEALTH_BACKLOG_THRESHOLD) {
    return true;
  }

  if (health.stuck.count > 0) {
    return true;
  }

  return false;
}

interface WorkerHealthStatusState {
  isUnhealthy: boolean;
  isLoading: boolean;
  lastChecked: Date | null;
  refresh: () => Promise<void>;
}

export function useWorkerHealthStatus(): WorkerHealthStatusState {
  const [isUnhealthy, setIsUnhealthy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/workers/health", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Worker health request failed: ${response.status}`);
      }

      const health: WorkerHealthStatusSnapshot = await response.json();
      setIsUnhealthy(isWorkerHealthUnhealthy(health));
    } catch {
      // Fail closed in the navigation indicator: unknown health is unhealthy.
      setIsUnhealthy(true);
    } finally {
      setIsLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, HEALTH_POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return {
    isUnhealthy,
    isLoading,
    lastChecked,
    refresh,
  };
}
