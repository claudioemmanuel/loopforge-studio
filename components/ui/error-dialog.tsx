"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Settings, RefreshCw, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ErrorAction } from "@/lib/errors/types";

export interface ErrorDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** If true, shows a link to settings */
  isApiKeyError?: boolean;
  /** Rate limit countdown in seconds */
  retryCountdown?: number;
  /** Custom action from API error */
  errorAction?: ErrorAction;
  /** Custom action button (legacy support) */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Callback when retry countdown finishes */
  onRetryReady?: () => void;
}

export function ErrorDialog({
  open,
  onClose,
  title,
  description,
  isApiKeyError = false,
  retryCountdown = 0,
  errorAction,
  action,
  onRetryReady,
}: ErrorDialogProps) {
  // Notify when countdown finishes
  React.useEffect(() => {
    if (retryCountdown === 0 && onRetryReady) {
      onRetryReady();
    }
  }, [retryCountdown, onRetryReady]);

  const isRateLimited = retryCountdown > 0;

  // Determine what action to show
  const renderActions = () => {
    // Rate limit with countdown
    if (isRateLimited) {
      return (
        <>
          <Button disabled className="gap-2">
            <Clock className="w-4 h-4" />
            Retry in {retryCountdown}s
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      );
    }

    // API key error
    if (isApiKeyError || errorAction?.type === "link") {
      const href = errorAction?.href || "/settings/integrations";
      const label = errorAction?.label || "Configure API Key";
      const isExternal = href.startsWith("http");

      return (
        <>
          {isExternal ? (
            <Button asChild>
              <a href={href} target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                {label}
              </a>
            </Button>
          ) : (
            <Button asChild>
              <Link href={href} className="gap-2">
                <Settings className="w-4 h-4" />
                {label}
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      );
    }

    // Retry action (from errorAction or legacy action)
    if (errorAction?.type === "retry" || action) {
      const handleRetry = action?.onClick || onClose;
      const label = errorAction?.label || action?.label || "Retry";

      return (
        <>
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {label}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      );
    }

    // Dismiss action or default close
    return (
      <Button onClick={onClose} className="min-w-[100px]">
        {errorAction?.label || "Close"}
      </Button>
    );
  };

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
            <div
              className={cn(
                "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4",
                isRateLimited ? "bg-amber-500/10" : "bg-destructive/10"
              )}
            >
              {isRateLimited ? (
                <Clock className="w-6 h-6 text-amber-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-destructive" />
              )}
            </div>

            {/* Title */}
            <DialogPrimitive.Title className="text-lg font-serif font-semibold tracking-tight mb-2">
              {title}
            </DialogPrimitive.Title>

            {/* Description */}
            <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogPrimitive.Description>

            {/* Countdown indicator */}
            {isRateLimited && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="relative w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (retryCountdown / 60) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {retryCountdown}s
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-4 pt-0 sm:flex-row sm:justify-center">
            {renderActions()}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
