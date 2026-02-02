"use client";

import { cn } from "@/lib/utils";
import { RefreshCw, Clock, AlertCircle, TrendingUp } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { RecoveryStatus } from "./recovery-status-badge";

interface RecoveryPopoverProps {
  status: RecoveryStatus;
  elapsedTime?: number; // milliseconds
  lastError?: string;
  children: React.ReactNode;
}

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

const tierDescriptions: Record<string, string> = {
  format_guidance:
    "Providing concrete examples of expected output format to help the AI understand formatting requirements.",
  simplified_prompt:
    "Simplifying the task to focus on single files at a time, reducing complexity.",
  context_reset:
    "Clearing conversation history and starting fresh with minimal context to avoid confusion.",
  manual_fallback:
    "Generating step-by-step instructions for manual intervention - AI needs help.",
};

export function RecoveryPopover({
  status,
  elapsedTime,
  lastError,
  children,
}: RecoveryPopoverProps) {
  if (status.status === "idle") {
    return <>{children}</>;
  }

  const tierName = status.currentTier
    ? status.currentTier.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : null;
  const tierDescription = status.currentTier
    ? tierDescriptions[status.currentTier]
    : null;

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" className="w-80">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  status.status === "recovering" &&
                    "bg-amber-100 dark:bg-amber-900/40",
                  status.status === "success" &&
                    "bg-emerald-100 dark:bg-emerald-900/40",
                  status.status === "failed" && "bg-red-100 dark:bg-red-900/40",
                )}
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4",
                    status.status === "recovering" &&
                      "text-amber-600 dark:text-amber-400 motion-safe:animate-spin",
                    status.status === "success" &&
                      "text-emerald-600 dark:text-emerald-400",
                    status.status === "failed" &&
                      "text-red-600 dark:text-red-400",
                  )}
                />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Auto-Recovery</h4>
                <p className="text-xs text-muted-foreground">
                  {status.status === "recovering"
                    ? "In Progress"
                    : status.status === "success"
                      ? "Completed Successfully"
                      : "Failed"}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {status.status === "recovering" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {status.progress.toFixed(0)}%
                </span>
              </div>
              <div className="relative w-full h-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-500 dark:bg-amber-400 transition-all duration-300 rounded-full"
                  style={{ width: `${status.progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent motion-safe:animate-shimmer" />
                </div>
              </div>
            </div>
          )}

          {/* Strategy Info */}
          {tierName && (
            <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Strategy: {tierName}</span>
              </div>
              {tierDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tierDescription}
                </p>
              )}
            </div>
          )}

          {/* Attempt Counter */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Attempt</span>
            <span className="font-mono font-medium">
              {status.attemptNumber} / {status.maxAttempts}
            </span>
          </div>

          {/* Elapsed Time */}
          {elapsedTime !== undefined && elapsedTime > 0 && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Elapsed</span>
              </div>
              <span className="font-mono font-medium">
                {formatElapsedTime(elapsedTime)}
              </span>
            </div>
          )}

          {/* Error Message (if failed) */}
          {status.status === "failed" && lastError && (
            <div className="space-y-1 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  Last Error
                </span>
              </div>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                {lastError.slice(0, 150)}
                {lastError.length > 150 ? "..." : ""}
              </p>
            </div>
          )}

          {/* Help Text */}
          {status.status === "recovering" && (
            <p className="text-xs text-muted-foreground">
              The AI is automatically trying different approaches to fix the issue.
              You&apos;ll be notified when recovery completes.
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
