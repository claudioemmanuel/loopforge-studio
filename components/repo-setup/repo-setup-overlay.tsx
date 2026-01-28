"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2, AlertCircle } from "lucide-react";

interface RepoSetupOverlayProps {
  repoId: string;
  repoName: string;
  isCloned: boolean;
  onCloneComplete?: () => void;
}

type CloneStatus = "idle" | "cloning" | "error";

export function RepoSetupOverlay({
  repoId,
  repoName,
  isCloned,
  onCloneComplete,
}: RepoSetupOverlayProps) {
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      onCloneComplete?.();
    } catch (error) {
      setCloneStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to clone repository",
      );
    }
  };

  // Don't show overlay if cloned
  if (isCloned) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
      <div className="max-w-md text-center p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          {cloneStatus === "error" ? (
            <AlertCircle className="w-8 h-8 text-red-500" />
          ) : (
            <GitBranch className="w-8 h-8 text-primary" />
          )}
        </div>

        <h3 className="text-xl font-semibold mb-2">
          {cloneStatus === "error" ? "Clone Failed" : "Set Up Repository"}
        </h3>

        <p className="text-muted-foreground mb-6">
          {cloneStatus === "cloning"
            ? `Cloning ${repoName}...`
            : cloneStatus === "error"
              ? errorMessage || "Failed to clone repository. Please try again."
              : "Clone this repository to start executing AI tasks. You can still organize tasks while it's not cloned."}
        </p>

        {cloneStatus === "idle" && (
          <Button size="lg" onClick={handleClone} className="gap-2">
            <GitBranch className="w-4 h-4" />
            Clone Repository
          </Button>
        )}

        {cloneStatus === "cloning" && (
          <Button size="lg" disabled className="gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cloning...
          </Button>
        )}

        {cloneStatus === "error" && (
          <Button
            size="lg"
            onClick={handleClone}
            variant="destructive"
            className="gap-2"
          >
            Try Again
          </Button>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Tasks can be created and organized without cloning.
          <br />
          Execution requires the repository to be cloned.
        </p>
      </div>
    </div>
  );
}
