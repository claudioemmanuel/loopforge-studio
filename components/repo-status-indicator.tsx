"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import type { IndexingStatus } from "@/lib/db/schema";
import { useTranslations } from "next-intl";

interface RepoStatusIndicatorProps {
  isCloned: boolean;
  indexingStatus: IndexingStatus;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { icon: 14, text: "text-xs" },
  md: { icon: 16, text: "text-sm" },
  lg: { icon: 20, text: "text-base" },
};

type StatusConfig = {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
  description: string;
};

function getStatusConfig(
  isCloned: boolean,
  indexingStatus: IndexingStatus,
  iconSize: number,
  t: (key: string) => string,
): StatusConfig {
  if (!isCloned) {
    return {
      icon: <XCircle size={iconSize} />,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      label: t("repositories.status.notCloned"),
      description: t("repositories.status.notClonedMessage"),
    };
  }

  switch (indexingStatus) {
    case "indexed":
      return {
        icon: <CheckCircle size={iconSize} />,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        label: t("repositories.status.ready"),
        description: t("repositories.status.readyMessage"),
      };
    case "indexing":
      return {
        icon: <Loader2 size={iconSize} className="animate-spin" />,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        label: t("repositories.status.indexing"),
        description: t("repositories.status.indexingMessage"),
      };
    case "pending":
      return {
        icon: <AlertCircle size={iconSize} />,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        label: t("repositories.status.pending"),
        description: t("repositories.status.pendingMessage"),
      };
    case "failed":
      return {
        icon: <AlertCircle size={iconSize} />,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        label: t("repositories.status.failed"),
        description: t("repositories.status.failedMessage"),
      };
    default:
      return {
        icon: <AlertCircle size={iconSize} />,
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        label: t("repositories.status.unknown"),
        description: t("repositories.status.unknownMessage"),
      };
  }
}

export function RepoStatusIndicator({
  isCloned,
  indexingStatus,
  className,
  showLabel = false,
  size = "md",
}: RepoStatusIndicatorProps) {
  const t = useTranslations();
  const { icon: iconSize, text: textSize } = sizeMap[size];
  const status = getStatusConfig(isCloned, indexingStatus, iconSize, t);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
              status.bgColor,
              status.color,
              className,
            )}
          >
            {status.icon}
            {showLabel && (
              <span className={cn("font-medium", textSize)}>
                {status.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{status.label}</p>
          <p className="text-xs text-muted-foreground">{status.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact version for use in lists/tables
export function RepoStatusDot({
  isCloned,
  indexingStatus,
  cloneStatus,
  className,
}: {
  isCloned: boolean;
  indexingStatus: IndexingStatus;
  cloneStatus?: "pending" | "cloning" | "completed" | "failed";
  className?: string;
}) {
  const t = useTranslations();
  const status = getStatusConfig(isCloned, indexingStatus, 12, t);

  // Determine color based on clone status (Phase 2.2)
  let dotColor = "bg-red-500";
  let statusLabel = status.label;
  let statusDescription = status.description;

  if (cloneStatus) {
    switch (cloneStatus) {
      case "completed":
        dotColor = "bg-green-500";
        statusLabel = t("repositories.clone.completed");
        statusDescription = t("repositories.clone.completedMessage");
        break;
      case "cloning":
        dotColor = "bg-orange-500 animate-pulse";
        statusLabel = t("repositories.clone.cloning");
        statusDescription = t("repositories.clone.cloningMessage");
        break;
      case "failed":
        dotColor = "bg-red-500";
        statusLabel = t("repositories.clone.failed");
        statusDescription = t("repositories.clone.failedMessage");
        break;
      case "pending":
      default:
        dotColor = "bg-red-500";
        statusLabel = t("repositories.clone.pending");
        statusDescription = t("repositories.clone.pendingMessage");
        break;
    }
  } else {
    // Fallback to old behavior if cloneStatus not provided
    dotColor =
      isCloned && indexingStatus === "indexed"
        ? "bg-green-500"
        : isCloned && indexingStatus === "indexing"
          ? "bg-yellow-500 animate-pulse"
          : isCloned && indexingStatus === "pending"
            ? "bg-orange-500"
            : "bg-red-500";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full",
              dotColor,
              className,
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">{statusLabel}</p>
          <p className="text-xs text-muted-foreground">{statusDescription}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Badge variant for cards/headers
export function RepoStatusBadge({
  isCloned,
  indexingStatus,
  className,
}: {
  isCloned: boolean;
  indexingStatus: IndexingStatus;
  className?: string;
}) {
  const t = useTranslations();
  const status = getStatusConfig(isCloned, indexingStatus, 14, t);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
        isCloned && indexingStatus === "indexed"
          ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
          : isCloned && indexingStatus === "indexing"
            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            : isCloned && indexingStatus === "pending"
              ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        className,
      )}
    >
      {status.icon}
      <span>{status.label}</span>
    </div>
  );
}
