"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  FileText,
  Play,
  Loader2,
  Clock,
  Sparkles,
} from "lucide-react";
import type { ProcessingPhase } from "@/lib/db/schema";
import type { CardProcessingState } from "@/components/hooks/use-card-processing";
import { SkillBadgeGroup } from "./skill-badge";

interface ProcessingPopoverProps {
  children: React.ReactNode;
  processingState: CardProcessingState;
}

type TranslationFunction = (key: string) => string;

// Phase configuration factory with colors and icons
function getPhaseConfig(t: TranslationFunction): Record<
  ProcessingPhase,
  {
    icon: typeof Lightbulb;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    progressColor: string;
  }
> {
  return {
    brainstorming: {
      icon: Lightbulb,
      label: t("tasks.statuses.brainstorming"),
      color: "text-violet-500 dark:text-violet-400",
      bgColor: "bg-violet-100/80 dark:bg-violet-900/40",
      borderColor: "border-violet-200 dark:border-violet-700",
      progressColor: "bg-violet-500",
    },
    planning: {
      icon: FileText,
      label: t("tasks.statuses.planning"),
      color: "text-blue-500 dark:text-blue-400",
      bgColor: "bg-blue-100/80 dark:bg-blue-900/40",
      borderColor: "border-blue-200 dark:border-blue-700",
      progressColor: "bg-blue-500",
    },
    executing: {
      icon: Play,
      label: t("tasks.statuses.executing"),
      color: "text-emerald-500 dark:text-emerald-400",
      bgColor: "bg-emerald-100/80 dark:bg-emerald-900/40",
      borderColor: "border-emerald-200 dark:border-emerald-700",
      progressColor: "bg-emerald-500",
    },
  };
}

// Legacy export for backwards compatibility in utility tests.
const phaseConfig = getPhaseConfig((key: string) => {
  switch (key) {
    case "tasks.statuses.brainstorming":
      return "Brainstorming";
    case "tasks.statuses.planning":
      return "Planning";
    case "tasks.statuses.executing":
      return "Executing";
    default:
      return key;
  }
});

// Format elapsed time
function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  const remainingSeconds = diffSeconds % 60;

  if (diffMinutes < 60) {
    return `${diffMinutes}m ${remainingSeconds}s`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  return `${diffHours}h ${remainingMinutes}m`;
}

export function ProcessingPopover({
  children,
  processingState,
}: ProcessingPopoverProps) {
  const t = useTranslations();
  const phaseConfigTranslated = getPhaseConfig(t);
  const config = phaseConfigTranslated[processingState.processingPhase];
  const PhaseIcon = config.icon;

  // Update elapsed time every second
  const elapsedTime = useMemo(() => {
    return formatElapsedTime(processingState.startedAt);
  }, [processingState.startedAt]);

  return (
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className={cn("w-80 p-0 overflow-hidden", config.borderColor)}
        side="right"
        align="start"
        sideOffset={8}
      >
        {/* Header */}
        <div
          className={cn(
            "px-4 py-3 border-b",
            config.bgColor,
            config.borderColor,
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md", config.bgColor)}>
              <PhaseIcon className={cn("w-4 h-4", config.color)} />
            </div>
            <div>
              <h4 className="font-medium text-sm">{config.label}</h4>
              <p className="text-xs text-muted-foreground">
                {processingState.taskTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Loader2 className={cn("w-4 h-4 animate-spin", config.color)} />
            <span className="text-sm">{processingState.statusText}</span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t("tasks.modal.progress")}
              </span>
              <span className={cn("font-medium tabular-nums", config.color)}>
                {processingState.progress}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  config.progressColor,
                )}
                style={{ width: `${processingState.progress}%` }}
              />
            </div>
          </div>

          {/* Elapsed time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {t("tasks.modal.elapsed")} {elapsedTime}
            </span>
          </div>

          {/* Active skills */}
          {processingState.activeSkills &&
            processingState.activeSkills.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t("tasks.modal.activeSkills")}</span>
                </div>
                <SkillBadgeGroup
                  skills={processingState.activeSkills}
                  compact={false}
                />
              </div>
            )}

          {/* Error message if any */}
          {processingState.error && (
            <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">
                {processingState.error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={cn(
            "px-4 py-2 border-t text-xs text-muted-foreground",
            config.borderColor,
          )}
        >
          {t("kanban.processingInBackground")}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Export phase config for use in other components
export { phaseConfig };
