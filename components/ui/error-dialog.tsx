"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Settings, RefreshCw } from "lucide-react";
import Link from "next/link";

export interface ErrorDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** If true, shows a link to settings */
  isApiKeyError?: boolean;
  /** Custom action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorDialog({
  open,
  onClose,
  title,
  description,
  isApiKeyError = false,
  action,
}: ErrorDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
            "fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%]",
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
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>

            {/* Title */}
            <DialogPrimitive.Title className="text-lg font-serif font-semibold tracking-tight mb-2">
              {title}
            </DialogPrimitive.Title>

            {/* Description */}
            <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogPrimitive.Description>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-4 pt-0 sm:flex-row sm:justify-center">
            {isApiKeyError ? (
              <>
                <Button asChild>
                  <Link href="/settings/integrations" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Configure API Key
                  </Link>
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </>
            ) : action ? (
              <>
                <Button onClick={action.onClick} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {action.label}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </>
            ) : (
              <Button onClick={onClose} className="min-w-[100px]">
                Close
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
