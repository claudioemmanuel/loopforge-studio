"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface SystemIssue {
  type: "worker" | "redis" | "queue" | "stuck";
  severity: "critical" | "warning";
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}

export function SystemStatusBanner() {
  const t = useTranslations("system.banner");
  const [issues, setIssues] = useState<SystemIssue[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch("/api/workers/health");
      if (!response.ok) {
        setIssues([
          {
            type: "worker",
            severity: "critical",
            message: "Unable to reach worker health endpoint",
          },
        ]);
        setIsVisible(true);
        return;
      }

      const health = await response.json();
      const detectedIssues: SystemIssue[] = [];

      // Check worker status
      if (health.worker.status === "stopped") {
        detectedIssues.push({
          type: "worker",
          severity: "critical",
          message: "Worker offline - tasks not processing",
          actionLabel: "View Worker Health",
          actionUrl: "/workers/health",
        });
      } else if (health.worker.status === "error") {
        detectedIssues.push({
          type: "worker",
          severity: "critical",
          message: "Worker error detected - check logs",
          actionLabel: "View Worker Health",
          actionUrl: "/workers/health",
        });
      }

      // Check Redis connection
      if (!health.redis.connected) {
        detectedIssues.push({
          type: "redis",
          severity: "critical",
          message: "Redis connection lost - real-time updates unavailable",
          actionLabel: "View Worker Health",
          actionUrl: "/workers/health",
        });
      }

      // Check queue backlog
      const totalWaiting =
        health.queues.brainstorm.waiting +
        health.queues.plan.waiting +
        health.queues.execution.waiting;

      if (totalWaiting > 10) {
        detectedIssues.push({
          type: "queue",
          severity: "warning",
          message: `Queue backed up - ${totalWaiting} tasks waiting`,
          actionLabel: "View Queues",
          actionUrl: "/workers/health",
        });
      }

      // Check stuck tasks
      if (health.stuck.count > 0) {
        detectedIssues.push({
          type: "stuck",
          severity: "warning",
          message: `${health.stuck.count} task${health.stuck.count > 1 ? "s" : ""} stuck`,
          actionLabel: "View Details",
          actionUrl: "/workers/health",
        });
      }

      setIssues(detectedIssues);
      setIsVisible(detectedIssues.length > 0 && !dismissed);

      // Re-show banner if new critical issues appear (even if previously dismissed)
      const hasCritical = detectedIssues.some((i) => i.severity === "critical");
      if (hasCritical && dismissed) {
        const dismissedKey = localStorage.getItem("system-banner-dismissed");
        const dismissedIssues = dismissedKey ? JSON.parse(dismissedKey) : [];
        const newCriticalIssues = detectedIssues.filter(
          (i) => i.severity === "critical" && !dismissedIssues.includes(i.type),
        );
        if (newCriticalIssues.length > 0) {
          setDismissed(false);
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.error("Error checking system health:", error);
      // Don't show banner for fetch errors to avoid false positives
    }
  };

  useEffect(() => {
    // Check immediately
    checkSystemHealth();

    // Check every 30 seconds
    const interval = setInterval(checkSystemHealth, 30000);

    // Re-check when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkSystemHealth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setIsVisible(false);

    // Store dismissed issue types in localStorage
    const dismissedTypes = issues.map((i) => i.type);
    localStorage.setItem(
      "system-banner-dismissed",
      JSON.stringify(dismissedTypes),
    );
  };

  if (!isVisible || issues.length === 0) {
    return null;
  }

  // Get the most severe issue to display
  const criticalIssue = issues.find((i) => i.severity === "critical");
  const displayIssue = criticalIssue || issues[0];

  const bgColor =
    displayIssue.severity === "critical"
      ? "bg-red-600 dark:bg-red-700"
      : "bg-yellow-600 dark:bg-yellow-700";

  return (
    <div
      className={`${bgColor} text-white px-6 py-3 flex items-center justify-between animate-in slide-in-from-top duration-300`}
    >
      <div className="flex items-center gap-3 flex-1">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">{displayIssue.message}</p>
          {issues.length > 1 && (
            <p className="text-sm opacity-90 mt-0.5">
              +{issues.length - 1} more issue{issues.length - 1 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {displayIssue.actionUrl && (
          <Link href={displayIssue.actionUrl}>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              {displayIssue.actionLabel}
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </Link>
        )}
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
