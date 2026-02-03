"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepoSetupBannerProps {
  repoId: string;
  repoName: string;
  isCloned: boolean;
  onCloneComplete?: () => void;
}

type CloneStatus = "pending" | "cloning" | "completed" | "failed";

export function RepoSetupBanner({
  repoId,
  repoName,
  isCloned,
  onCloneComplete,
}: RepoSetupBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(`repo-setup-dismissed-${repoId}`, "true");
  }, [repoId]);

  // Check localStorage for dismissed state
  useEffect(() => {
    const dismissedKey = `repo-setup-dismissed-${repoId}`;
    const isDismissed = localStorage.getItem(dismissedKey) === "true";
    setDismissed(isDismissed);
  }, [repoId]);

  // Auto-dismiss on successful clone
  useEffect(() => {
    if (isCloned && cloneStatus === "completed") {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCloned, cloneStatus, handleDismiss]);

  const handleClone = async () => {
    setCloneStatus("cloning");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/repos/${repoId}/clone`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clone repository");
      }

      setCloneStatus("completed");
      onCloneComplete?.();
    } catch (error) {
      setCloneStatus("failed");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to clone repository",
      );
    }
  };

  // Don't show if already cloned, dismissed, or successfully cloned
  if (isCloned || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative border-l-4 rounded-lg p-4 mb-4 transition-all duration-300",
        cloneStatus === "failed"
          ? "bg-red-500/10 border-red-500"
          : cloneStatus === "completed"
            ? "bg-emerald-500/10 border-emerald-500"
            : "bg-amber-500/10 border-amber-500",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {cloneStatus === "completed" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          ) : cloneStatus === "failed" ? (
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <h4 className="font-medium text-foreground">
              {cloneStatus === "completed"
                ? "Repository Cloned"
                : cloneStatus === "failed"
                  ? "Clone Failed"
                  : "Repository Not Cloned"}
            </h4>
            <p className="text-sm text-muted-foreground mt-0.5">
              {cloneStatus === "cloning"
                ? `Cloning ${repoName}...`
                : cloneStatus === "completed"
                  ? "Repository is ready for AI task execution"
                  : cloneStatus === "failed"
                    ? errorMessage || "Please try again"
                    : "Clone this repository to enable AI task execution"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cloneStatus === "pending" && (
            <Button size="sm" onClick={handleClone} className="gap-2">
              Clone Now
            </Button>
          )}
          {cloneStatus === "cloning" && (
            <Button size="sm" disabled className="gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cloning...
            </Button>
          )}
          {cloneStatus === "failed" && (
            <Button
              size="sm"
              onClick={handleClone}
              variant="destructive"
              className="gap-2"
            >
              Retry
            </Button>
          )}
          {cloneStatus !== "cloning" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      {cloneStatus === "cloning" && (
        <div className="mt-3">
          <div className="h-1 bg-amber-500/20 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}
    </div>
  );
}
