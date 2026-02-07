"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkerStatusCard } from "@/components/workers/worker-status-card";
import { RedisStatusCard } from "@/components/workers/redis-status-card";
import { QueueMetricsCard } from "@/components/workers/queue-metrics-card";
import { RecentFailuresCard } from "@/components/workers/recent-failures-card";

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface WorkerHealthApiResponse {
  worker: {
    status: "running" | "stopped" | "error";
    uptime: number | null;
    lastHeartbeat: string | null;
    restartCount: number;
  };
  queues: {
    brainstorm: QueueStats;
    plan: QueueStats;
    execution: QueueStats;
  };
  redis: {
    connected: boolean;
    memoryUsage: string;
    uptimeSeconds: number;
  };
  failures: {
    count: number;
    recent: Array<{
      taskId: string;
      phase: string;
      error: string;
      timestamp: string;
    }>;
  };
  stuck: {
    count: number;
    tasks: Array<{
      taskId: string;
      title: string;
      stuckDuration: string;
    }>;
  };
}

interface WorkerHealthViewModel {
  worker: {
    status: "running" | "stopped" | "error";
    uptime: number | null;
    lastHeartbeat: Date | null;
    restartCount: number;
  };
  queues: {
    brainstorm: QueueStats;
    plan: QueueStats;
    execution: QueueStats;
  };
  redis: {
    connected: boolean;
    memoryUsage: string;
    uptimeSeconds: number;
  };
  failures: {
    count: number;
    recent: Array<{
      taskId: string;
      phase: string;
      error: string;
      timestamp: Date;
    }>;
  };
  stuck: {
    count: number;
    tasks: Array<{
      taskId: string;
      title: string;
      stuckDuration: string;
    }>;
  };
}

const HEALTH_REFRESH_INTERVAL_MS = 30_000;

function toViewModel(api: WorkerHealthApiResponse): WorkerHealthViewModel {
  return {
    worker: {
      status: api.worker.status,
      uptime: api.worker.uptime,
      lastHeartbeat: api.worker.lastHeartbeat
        ? new Date(api.worker.lastHeartbeat)
        : null,
      restartCount: api.worker.restartCount,
    },
    queues: api.queues,
    redis: api.redis,
    failures: {
      count: api.failures.count,
      recent: api.failures.recent.map((failure) => ({
        taskId: failure.taskId,
        phase: failure.phase,
        error: failure.error,
        timestamp: new Date(failure.timestamp),
      })),
    },
    stuck: api.stuck,
  };
}

export default function WorkersHealthPageClient() {
  const t = useTranslations("workers.health");
  const [health, setHealth] = useState<WorkerHealthViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/workers/health", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Health API request failed (${response.status})`);
      }

      const data: WorkerHealthApiResponse = await response.json();
      setHealth(toViewModel(data));
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError("Failed to load worker health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, HEALTH_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("pageDescription")}</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("lastUpdated")}: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => void refresh()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t("refresh")}
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !health ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-48 animate-pulse bg-muted/30" />
          <Card className="h-48 animate-pulse bg-muted/30" />
          <Card className="h-72 animate-pulse bg-muted/30" />
          <Card className="h-72 animate-pulse bg-muted/30" />
        </div>
      ) : (
        health && (
          <div className="grid gap-4 md:grid-cols-2">
            <WorkerStatusCard
              status={health.worker.status}
              uptime={health.worker.uptime}
              lastHeartbeat={health.worker.lastHeartbeat}
              restartCount={health.worker.restartCount}
            />
            <RedisStatusCard
              connected={health.redis.connected}
              memoryUsage={health.redis.memoryUsage}
              uptimeSeconds={health.redis.uptimeSeconds}
            />
            <QueueMetricsCard queues={health.queues} />
            <RecentFailuresCard
              failures={health.failures}
              stuck={health.stuck}
            />
          </div>
        )
      )}
    </div>
  );
}
