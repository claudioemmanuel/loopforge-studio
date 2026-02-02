"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { WorkerStatusCard } from "@/components/workers/worker-status-card";
import { QueueMetricsCard } from "@/components/workers/queue-metrics-card";
import { RedisStatusCard } from "@/components/workers/redis-status-card";
import { RecentFailuresCard } from "@/components/workers/recent-failures-card";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkerHealth {
  worker: {
    status: "running" | "stopped" | "error";
    uptime: number | null;
    lastHeartbeat: Date | null;
    restartCount: number;
  };
  queues: {
    brainstorm: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
    plan: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
    execution: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
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

export default function WorkerHealthPage() {
  const t = useTranslations("workers.health");
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);

      const response = await fetch("/api/workers/health");
      if (!response.ok) {
        throw new Error("Failed to fetch worker health");
      }

      const data = await response.json();
      setHealth(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Error fetching worker health:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => fetchHealth(), 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    fetchHealth(true);
  };

  if (loading && !health) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-red-600 dark:text-red-500">{error}</p>
          <Button onClick={handleManualRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("pageDescription")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              {t("lastUpdated")}: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {/* Health Cards Grid */}
      {health && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          <WorkerStatusCard
            status={health.worker.status}
            uptime={health.worker.uptime}
            lastHeartbeat={health.worker.lastHeartbeat}
            restartCount={health.worker.restartCount}
          />
          <QueueMetricsCard queues={health.queues} />
          <RedisStatusCard
            connected={health.redis.connected}
            memoryUsage={health.redis.memoryUsage}
            uptimeSeconds={health.redis.uptimeSeconds}
          />
          <RecentFailuresCard
            failures={health.failures}
            stuck={health.stuck}
          />
        </div>
      )}
    </div>
  );
}
