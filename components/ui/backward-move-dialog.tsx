"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import type { TaskStatus } from "@/lib/db/schema";

// Workflow order for determining backward movement
const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  brainstorming: 1,
  planning: 2,
  ready: 3,
  executing: 4,
  done: 5,
  stuck: -1, // Special status, doesn't participate in forward/backward logic
};

// Human-readable status names
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  brainstorming: "Brainstorming",
  planning: "Planning",
  ready: "Ready",
  executing: "Executing",
  done: "Done",
  stuck: "Failed",
};

// Determine what data gets cleared based on target status
function getResetDescription(toStatus: TaskStatus): string | null {
  switch (toStatus) {
    case "todo":
      return "This will clear existing brainstorm notes and plans";
    case "brainstorming":
      return "This will clear the existing plan";
    default:
      return null;
  }
}

export interface BackwardMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  taskTitle: string;
  onKeepData: () => void;
  onReset: () => void;
}

/**
 * Check if a move is considered "backward" in the workflow
 */
export function isBackwardMove(
  fromStatus: TaskStatus,
  toStatus: TaskStatus
): boolean {
  // Stuck status can move freely without warnings
  if (fromStatus === "stuck" || toStatus === "stuck") {
    return false;
  }

  const fromIndex = STATUS_ORDER[fromStatus];
  const toIndex = STATUS_ORDER[toStatus];

  // A move is backward if going from a higher index to a lower index
  return fromIndex > toIndex;
}

export function BackwardMoveDialog({
  open,
  onOpenChange,
  fromStatus,
  toStatus,
  taskTitle,
  onKeepData,
  onReset,
}: BackwardMoveDialogProps) {
  const resetDescription = getResetDescription(toStatus);

  const handleKeepData = () => {
    onKeepData();
    onOpenChange(false);
  };

  const handleReset = () => {
    onReset();
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%]",
            "bg-card rounded-2xl border shadow-2xl p-0 overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "duration-200"
          )}
        >
          {/* Close button */}
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 p-1.5 rounded-lg",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Content */}
          <div className="p-6 pt-8 text-center">
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-amber-500/10">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>

            {/* Title */}
            <DialogPrimitive.Title className="text-lg font-serif font-semibold tracking-tight mb-2">
              Move Task Backward?
            </DialogPrimitive.Title>

            {/* Description */}
            <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
              Moving{" "}
              <span className="font-medium text-foreground">
                &ldquo;{taskTitle}&rdquo;
              </span>{" "}
              from{" "}
              <span className="font-medium text-foreground">
                {STATUS_LABELS[fromStatus]}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {STATUS_LABELS[toStatus]}
              </span>{" "}
              will affect its progress.
            </DialogPrimitive.Description>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-4 pt-0">
            {/* Keep Data - Primary action */}
            <Button onClick={handleKeepData} className="w-full">
              Move &amp; Keep Data
            </Button>

            {/* Reset - Secondary action (only show if there's data to reset) */}
            {resetDescription && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full flex flex-col items-center gap-0.5 h-auto py-2"
              >
                <span>Move &amp; Reset</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {resetDescription}
                </span>
              </Button>
            )}

            {/* Cancel - Tertiary action */}
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
