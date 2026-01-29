"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { CardProcessingState } from "@/components/hooks/use-card-processing";

interface CardProcessingOverlayProps {
  processingState: CardProcessingState;
}

/**
 * Overlay shown on a Kanban card while a task is being processed.
 *
 * Displays a spinner colored by processing phase, a status text label, and a
 * progress bar.
 */
export function CardProcessingOverlay({
  processingState,
}: CardProcessingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Processing: ${processingState.statusText}`}
      className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center gap-2 p-4"
    >
      <Loader2
        className={cn(
          "w-6 h-6 animate-spin",
          processingState.processingPhase === "brainstorming" &&
            "text-violet-500",
          processingState.processingPhase === "planning" && "text-blue-500",
          processingState.processingPhase === "executing" && "text-emerald-500",
        )}
      />
      <span className="text-xs font-medium text-muted-foreground text-center">
        {processingState.statusText}
      </span>
      <div className="w-full max-w-[120px] h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            processingState.processingPhase === "brainstorming" &&
              "bg-violet-500",
            processingState.processingPhase === "planning" && "bg-blue-500",
            processingState.processingPhase === "executing" && "bg-emerald-500",
          )}
          style={{ width: `${processingState.progress}%` }}
        />
      </div>
    </div>
  );
}
