"use client";

import { cn } from "@/lib/utils";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface RecoveryStatus {
  isRecovering: boolean;
  currentTier: string | null;
  attemptNumber: number;
  maxAttempts: number;
  progress: number; // 0-100
  status: "idle" | "recovering" | "success" | "failed";
}

interface RecoveryStatusBadgeProps {
  status: RecoveryStatus;
  compact?: boolean;
}

const tierDisplayNames: Record<string, string> = {
  format_guidance: "Format Guidance",
  simplified_prompt: "Simplified Prompt",
  context_reset: "Context Reset",
  manual_fallback: "Manual Fallback",
};

export function RecoveryStatusBadge({
  status,
  compact = false,
}: RecoveryStatusBadgeProps) {
  if (status.status === "idle") {
    return null;
  }

  // Determine icon and styling based on status
  let Icon = RefreshCw;
  let iconClass = "w-3 h-3";
  let containerClass = "";
  let textClass = "";
  let text = "";

  switch (status.status) {
    case "recovering":
      Icon = RefreshCw;
      iconClass = cn(iconClass, "motion-safe:animate-spin");
      containerClass =
        "bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
      textClass = "text-amber-700 dark:text-amber-300";
      text = compact
        ? `Recovery ${status.attemptNumber}/${status.maxAttempts}`
        : `Recovering • Attempt ${status.attemptNumber} of ${status.maxAttempts}`;
      break;

    case "success":
      Icon = CheckCircle;
      containerClass =
        "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";
      textClass = "text-emerald-700 dark:text-emerald-300";
      text = "Recovered";
      break;

    case "failed":
      Icon = XCircle;
      containerClass =
        "bg-red-100/80 dark:bg-red-900/40 text-red-700 dark:text-red-300";
      textClass = "text-red-700 dark:text-red-300";
      text = "Recovery Failed";
      break;
  }

  const tierName = status.currentTier
    ? tierDisplayNames[status.currentTier] || status.currentTier
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              "border transition-all duration-200",
              containerClass,
            )}
          >
            <Icon className={iconClass} />
            <span className="font-medium">{text}</span>
            {status.status === "recovering" && status.progress > 0 && (
              <div className="relative w-12 h-1 bg-amber-200/50 dark:bg-amber-800/50 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-500 dark:bg-amber-400 transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className={cn("font-medium", textClass)}>
              {status.status === "recovering"
                ? "Auto-Recovery in Progress"
                : status.status === "success"
                  ? "Recovery Successful"
                  : "Recovery Failed"}
            </p>
            {tierName && (
              <p className="text-xs text-muted-foreground">
                Strategy: {tierName}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Attempt {status.attemptNumber} of {status.maxAttempts}
            </p>
            {status.progress > 0 && (
              <p className="text-xs text-muted-foreground">
                Progress: {status.progress.toFixed(0)}%
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
