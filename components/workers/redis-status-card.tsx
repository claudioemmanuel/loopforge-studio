"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, CheckCircle, XCircle, HardDrive, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface RedisStatusCardProps {
  connected: boolean;
  memoryUsage: string;
  uptimeSeconds: number;
}

export function RedisStatusCard({
  connected,
  memoryUsage,
  uptimeSeconds,
}: RedisStatusCardProps) {
  const t = useTranslations("workers.health");

  const formatUptime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t("cards.redis.title")}
        </CardTitle>
        <Database className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            {connected ? (
              <>
                <div className="rounded-full p-2 bg-green-50 dark:bg-green-950/50 relative">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                  <span className="absolute ml-[-1.25rem] mt-[-1.25rem] flex h-9 w-9">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                    {t("cards.redis.connected")}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {t("cards.redis.statusLabel")}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full p-2 bg-red-50 dark:bg-red-950/50">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                    {t("cards.redis.disconnected")}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {t("cards.redis.statusLabel")}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Metrics */}
          {connected && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {t("cards.redis.memory")}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {memoryUsage}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("cards.redis.uptime")}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatUptime(uptimeSeconds)}
                </p>
              </div>
            </div>
          )}

          {/* Disconnected Warning */}
          {!connected && (
            <div className="pt-2 border-t">
              <p className="text-sm text-red-600 dark:text-red-500">
                {t("cards.redis.disconnectedWarning")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
