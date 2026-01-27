"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Play, X } from "lucide-react";
import type { TaskStatus } from "@/lib/db/schema";

// Human-readable status names
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  brainstorming: "Brainstorming",
  planning: "Planning",
  ready: "Ready",
  executing: "Executing",
  review: "Review",
  done: "Done",
  stuck: "Failed",
};

// Action descriptions for each target status
const ACTION_INFO: Record<
  string,
  { title: string; description: string; buttonText: string }
> = {
  brainstorming: {
    title: "Start Brainstorming",
    description:
      "This will start AI-powered brainstorming to analyze the task and discuss the approach.",
    buttonText: "Start Brainstorming",
  },
  planning: {
    title: "Start Planning",
    description:
      "This will generate an AI execution plan based on the brainstorming session.",
    buttonText: "Start Planning",
  },
  executing: {
    title: "Start Execution",
    description:
      "This will start the AI agent to implement the planned changes and commit them to GitHub.",
    buttonText: "Start Execution",
  },
};

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  taskTitle,
  fromStatus,
  toStatus,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmActionDialogProps) {
  const actionInfo = ACTION_INFO[toStatus];

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  if (!actionInfo) {
    return null;
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
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
            "duration-200",
          )}
        >
          {/* Close button */}
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 p-1.5 rounded-lg",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
            )}
            disabled={loading}
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Content */}
          <div className="p-6 pt-8 text-center">
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-primary/10">
              <Play className="w-6 h-6 text-primary" />
            </div>

            {/* Title */}
            <DialogPrimitive.Title className="text-lg font-serif font-semibold tracking-tight mb-2">
              {actionInfo.title}
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
              </span>
              .
            </DialogPrimitive.Description>

            {/* Action info */}
            <p className="text-sm text-muted-foreground mt-3">
              {actionInfo.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-4 pt-0">
            {/* Confirm - Primary action */}
            <Button
              onClick={handleConfirm}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                actionInfo.buttonText
              )}
            </Button>

            {/* Cancel - Secondary action */}
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="w-full text-muted-foreground"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Action columns that require confirmation before triggering
export const ACTION_COLUMNS: TaskStatus[] = [
  "brainstorming",
  "planning",
  "executing",
];

/**
 * Check if a target status requires an action confirmation
 */
export function requiresActionConfirmation(toStatus: TaskStatus): boolean {
  return ACTION_COLUMNS.includes(toStatus);
}
