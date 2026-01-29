"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GitBranch, Loader2 } from "lucide-react";

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

  const isCloning = cloneStatus === "cloning";

  return (
    <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-md rounded-lg">
      <div className="flex items-start justify-center pt-12 px-4">
        <Alert
          variant={cloneStatus === "error" ? "destructive" : "default"}
          className="max-w-2xl"
        >
          <GitBranch className="h-5 w-5" />
          <AlertTitle>Repository Setup Required</AlertTitle>
          <AlertDescription>
            {cloneStatus === "cloning"
              ? `Cloning ${repoName}...`
              : cloneStatus === "error"
                ? errorMessage ||
                  "Failed to clone repository. Please try again."
                : "Clone this repository to start executing AI tasks. You can still organize tasks while it's not cloned."}
          </AlertDescription>
          <div className="mt-4 flex gap-2">
            {cloneStatus === "error" ? (
              <Button
                onClick={handleClone}
                disabled={isCloning}
                variant="destructive"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Try Again
                  </>
                )}
              </Button>
            ) : cloneStatus === "cloning" ? (
              <Button disabled variant="outline">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cloning...
              </Button>
            ) : (
              <Button onClick={handleClone} disabled={isCloning}>
                {isCloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Clone Repository
                  </>
                )}
              </Button>
            )}
          </div>
        </Alert>
      </div>
    </div>
  );
}
