"use client";

import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, GitBranch } from "lucide-react";
import { CloneDirectoryModal } from "@/components/settings/clone-directory-modal";

interface RepoSetupOverlayProps {
  repoId: string;
  repoName: string;
  isCloned: boolean;
  onCloneComplete?: () => void;
}

export function RepoSetupOverlay({
  repoId,
  repoName,
  isCloned,
  onCloneComplete,
}: RepoSetupOverlayProps) {
  const [cloneStatus, setCloneStatus] = useState<
    "pending" | "cloning" | "completed" | "failed"
  >("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<{
    phase: "preparing" | "cloning" | "indexing";
    substep?: string;
    percentage?: number;
  } | null>(null);
  const [showCloneDirModal, setShowCloneDirModal] = useState(false);

  // Auto-hide after successful clone (with delay for user feedback)
  useEffect(() => {
    if (cloneStatus === "completed") {
      const timer = setTimeout(() => {
        // Call parent callback if provided, otherwise refresh page
        if (onCloneComplete) {
          onCloneComplete();
        } else {
          window.location.reload();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [cloneStatus, onCloneComplete]);

  const checkCloneDirectory = async () => {
    try {
      const res = await fetch("/api/settings/clone-directory");
      const data = await res.json();

      if (!data.cloneDirectory) {
        setShowCloneDirModal(true);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleClone = async () => {
    // Check configuration first
    const hasConfig = await checkCloneDirectory();
    if (!hasConfig) {
      return; // Modal will show
    }

    setIsCloning(true);
    setCloneStatus("cloning");
    setErrorMessage(null);
    setCloneProgress({ phase: "preparing", percentage: 0 });

    try {
      const res = await fetch(`/api/repos/${repoId}/clone`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();

        // Handle configuration requirement
        if (errorData.requiresConfiguration) {
          setShowCloneDirModal(true);
          setCloneStatus("pending");
          setCloneProgress(null);
          return;
        }

        throw new Error(errorData.error || "Failed to clone repository");
      }

      // Simulate progress for MVP (real streaming in future enhancement)
      setCloneProgress({ phase: "cloning", percentage: 50 });

      setTimeout(() => {
        setCloneProgress({ phase: "indexing", percentage: 90 });
      }, 1000);

      setCloneStatus("completed");
    } catch (error) {
      setCloneStatus("failed");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    } finally {
      setIsCloning(false);
      setCloneProgress(null);
    }
  };

  // Don't render if already cloned
  if (isCloned) return null;

  // Determine dialog state based on clone status
  const isError = cloneStatus === "failed";
  const isSuccess = cloneStatus === "completed";

  return (
    <DialogPrimitive.Root open={true}>
      <DialogPrimitive.Portal>
        {/* Backdrop - stronger blur to indicate blocked state */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-20 bg-background/80 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />

        {/* Dialog Content - Centered Modal */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-20 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%]",
            "bg-card rounded-2xl border shadow-2xl p-0 overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "duration-200",
          )}
        >
          {/* Content */}
          <div className="p-6 pt-8 text-center">
            {/* Icon - GitBranch in colored circle */}
            <div
              className={cn(
                "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4",
                isError
                  ? "bg-destructive/10"
                  : isSuccess
                    ? "bg-emerald-500/10"
                    : "bg-primary/10",
              )}
            >
              {isCloning ? (
                <Loader2
                  className={cn(
                    "w-6 h-6 animate-spin",
                    isError
                      ? "text-destructive"
                      : isSuccess
                        ? "text-emerald-500"
                        : "text-primary",
                  )}
                />
              ) : (
                <GitBranch
                  className={cn(
                    "w-6 h-6",
                    isError
                      ? "text-destructive"
                      : isSuccess
                        ? "text-emerald-500"
                        : "text-primary",
                  )}
                />
              )}
            </div>

            {/* Title */}
            <DialogPrimitive.Title className="text-lg font-serif font-semibold tracking-tight mb-2">
              {isSuccess
                ? "Repository Cloned!"
                : isError
                  ? "Clone Failed"
                  : "Repository Setup Required"}
            </DialogPrimitive.Title>

            {/* Description */}
            <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
              {isSuccess ? (
                <span>
                  Successfully cloned{" "}
                  <span className="font-medium text-foreground">
                    {repoName}
                  </span>
                  . Refreshing...
                </span>
              ) : cloneStatus === "cloning" ? (
                <span>
                  Cloning{" "}
                  <span className="font-medium text-foreground">
                    {repoName}
                  </span>
                  ...
                </span>
              ) : isError ? (
                <span>
                  {errorMessage ||
                    "Failed to clone repository. Please try again."}
                </span>
              ) : (
                <span>
                  Clone{" "}
                  <span className="font-medium text-foreground">
                    {repoName}
                  </span>{" "}
                  to start executing AI tasks. You can still organize tasks
                  while it&apos;s not cloned.
                </span>
              )}
            </DialogPrimitive.Description>

            {/* Progress UI */}
            {cloneProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium">
                    {cloneProgress.phase}...
                  </span>
                  {cloneProgress.percentage !== undefined && (
                    <span className="text-muted-foreground">
                      {cloneProgress.percentage}%
                    </span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${cloneProgress.percentage || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-4 pt-0">
            {isError ? (
              <>
                {/* Try Again - Primary action on error */}
                <Button
                  onClick={handleClone}
                  disabled={isCloning}
                  variant="destructive"
                  className="w-full"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-4 h-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
              </>
            ) : isSuccess ? (
              // No action needed - auto-refreshing
              <div className="text-center text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Loading repository...
              </div>
            ) : cloneStatus === "cloning" ? (
              // Cloning in progress - show disabled button
              <Button disabled variant="outline" className="w-full">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cloning...
              </Button>
            ) : (
              // Idle state - show clone button
              <Button
                onClick={handleClone}
                disabled={isCloning}
                className="w-full"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                Clone Repository
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {/* Clone Directory Configuration Modal */}
      <CloneDirectoryModal
        open={showCloneDirModal}
        onOpenChange={setShowCloneDirModal}
        onConfigured={() => {
          setShowCloneDirModal(false);
          handleClone();
        }}
      />
    </DialogPrimitive.Root>
  );
}
