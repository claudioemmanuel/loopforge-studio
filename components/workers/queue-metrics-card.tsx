"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Clock, CheckCircle2, XCircle, Pause } from "lucide-react";
import { useTranslations } from "next-intl";

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface QueueMetricsCardProps {
  queues: {
    brainstorm: QueueStats;
    plan: QueueStats;
    execution: QueueStats;
  };
}

export function QueueMetricsCard({ queues }: QueueMetricsCardProps) {
  const t = useTranslations("workers.health");

  const queueNames = [
    { key: "brainstorm", label: t("cards.queues.brainstorm") },
    { key: "plan", label: t("cards.queues.plan") },
    { key: "execution", label: t("cards.queues.execution") },
  ] as const;

  const getTotalActive = () => {
    return queues.brainstorm.active + queues.plan.active + queues.execution.active;
  };

  const getTotalWaiting = () => {
    return queues.brainstorm.waiting + queues.plan.waiting + queues.execution.waiting;
  };

  const getStatusColor = (waiting: number, active: number) => {
    if (waiting > 10) return "text-red-600 dark:text-red-500";
    if (waiting > 5) return "text-yellow-600 dark:text-yellow-500";
    if (active > 0) return "text-blue-600 dark:text-blue-500";
    return "text-green-600 dark:text-green-500";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t("cards.queues.title")}
        </CardTitle>
        <Layers className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("cards.queues.totalActive")}
              </p>
              <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
                {getTotalActive()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("cards.queues.totalWaiting")}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${getStatusColor(getTotalWaiting(), getTotalActive())}`}>
                {getTotalWaiting()}
              </p>
            </div>
          </div>

          {/* Queue Details */}
          <div className="space-y-3 pt-2 border-t">
            {queueNames.map(({ key, label }) => {
              const stats = queues[key];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{label}</p>
                    <div className="flex items-center gap-2">
                      {stats.active > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-500">
                          <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500 animate-pulse" />
                          {stats.active} active
                        </span>
                      )}
                      {stats.waiting > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {stats.waiting} waiting
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {stats.completed}
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-600" />
                      {stats.failed}
                    </span>
                    {stats.paused > 0 && (
                      <span className="flex items-center gap-1">
                        <Pause className="h-3 w-3 text-yellow-600" />
                        {stats.paused}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alert for backlog */}
          {getTotalWaiting() > 10 && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
                <Clock className="h-4 w-4" />
                <p>{t("cards.queues.backlogWarning")}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
