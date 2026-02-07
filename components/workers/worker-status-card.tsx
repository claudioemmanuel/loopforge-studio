"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface WorkerStatusCardProps {
  status: "running" | "stopped" | "error";
  uptime: number | null;
  lastHeartbeat: Date | null;
  restartCount: number;
}

export function WorkerStatusCard({
  status,
  uptime,
  lastHeartbeat,
  restartCount,
}: WorkerStatusCardProps) {
  const t = useTranslations("workers.health");

  const statusConfig = {
    running: {
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/50",
      label: t("status.running"),
      pulse: true,
      pulseColor: "bg-green-400/75",
    },
    stopped: {
      icon: XCircle,
      color: "text-gray-500 dark:text-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-950/50",
      label: t("status.stopped"),
      pulse: false,
      pulseColor: "",
    },
    error: {
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/50",
      label: t("status.error"),
      pulse: true,
      pulseColor: "bg-red-400/75",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const formatUptime = (milliseconds: number | null) => {
    if (!milliseconds) return "N/A";

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const formatLastHeartbeat = (date: Date | null) => {
    if (!date) return "Never";

    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t("cards.worker.title")}
        </CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <div
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full ${config.bgColor}`}
            >
              {config.pulse && (
                <span className="pointer-events-none absolute inset-0 rounded-full">
                  <span
                    className={`absolute inset-0 rounded-full animate-ping ${config.pulseColor}`}
                  ></span>
                </span>
              )}
              <Icon className={`relative z-10 h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{config.label}</p>
              <p className="text-xs text-muted-foreground uppercase">
                {t("cards.worker.statusLabel")}
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("cards.worker.uptime")}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {formatUptime(uptime)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("cards.worker.lastHeartbeat")}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {formatLastHeartbeat(lastHeartbeat)}
              </p>
            </div>
          </div>

          {/* Restart Count */}
          {restartCount > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                {t("cards.worker.restarts")}:{" "}
                <span className="font-semibold">{restartCount}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
