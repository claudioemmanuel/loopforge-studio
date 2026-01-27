"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  FolderGit2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderSearch,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IndexingStatus } from "@/lib/db/schema";

interface RepoSetupItem {
  id: string;
  name: string;
  fullName: string;
  suggestedPaths?: string[];
  selectedPath?: string;
  customPath?: string;
  status: "pending" | "verifying" | "cloning" | "indexing" | "ready" | "error";
  errorMessage?: string;
  isCloned?: boolean;
  indexingStatus?: IndexingStatus;
}

interface RepoSetupModalProps {
  repos: Array<{
    id: string;
    name: string;
    fullName: string;
    suggestedPaths?: string[];
  }>;
  onClose: () => void;
  onComplete: () => void;
}

export function RepoSetupModal({
  repos,
  onClose,
  onComplete,
}: RepoSetupModalProps) {
  const [repoItems, setRepoItems] = useState<RepoSetupItem[]>(() =>
    repos.map((r) => ({
      ...r,
      status: "pending" as const,
      selectedPath: r.suggestedPaths?.[0],
    })),
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Check clone status for each repo on mount
  useEffect(() => {
    const repoIds = repos.map((r) => r.id);

    const checkStatuses = async () => {
      for (const repoId of repoIds) {
        try {
          const res = await fetch(`/api/repos/${repoId}/clone-status`);
          if (res.ok) {
            const data = await res.json();
            setRepoItems((prev) =>
              prev.map((r) =>
                r.id === repoId
                  ? {
                      ...r,
                      isCloned: data.isCloned,
                      indexingStatus: data.indexingStatus,
                      status: data.isCloned
                        ? data.indexingStatus === "indexed"
                          ? "ready"
                          : data.indexingStatus === "indexing"
                            ? "indexing"
                            : "pending"
                        : "pending",
                    }
                  : r,
              ),
            );
          }
        } catch {
          // Ignore errors, status will remain pending
        }
      }
    };

    checkStatuses();
  }, [repos]);

  // Memoize the list of repo IDs currently indexing
  const indexingRepoIds = useMemo(
    () => repoItems.filter((r) => r.status === "indexing").map((r) => r.id),
    [repoItems],
  );

  // Poll for indexing status updates
  useEffect(() => {
    if (indexingRepoIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const repoId of indexingRepoIds) {
        try {
          const res = await fetch(`/api/repos/${repoId}/clone-status`);
          if (res.ok) {
            const data = await res.json();
            setRepoItems((prev) =>
              prev.map((r) =>
                r.id === repoId
                  ? {
                      ...r,
                      indexingStatus: data.indexingStatus,
                      status:
                        data.indexingStatus === "indexed"
                          ? "ready"
                          : data.indexingStatus === "failed"
                            ? "error"
                            : "indexing",
                      errorMessage:
                        data.indexingStatus === "failed"
                          ? "Indexing failed"
                          : undefined,
                    }
                  : r,
              ),
            );
          }
        } catch {
          // Ignore poll errors
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [indexingRepoIds]);

  const handlePathSelect = (repoId: string, path: string) => {
    setRepoItems((prev) =>
      prev.map((r) =>
        r.id === repoId ? { ...r, selectedPath: path, customPath: "" } : r,
      ),
    );
  };

  const handleCustomPathChange = (repoId: string, value: string) => {
    setRepoItems((prev) =>
      prev.map((r) =>
        r.id === repoId
          ? { ...r, customPath: value, selectedPath: value || undefined }
          : r,
      ),
    );
  };

  const verifyAndSetPath = async (repo: RepoSetupItem) => {
    const pathToVerify = repo.customPath || repo.selectedPath;
    if (!pathToVerify) return false;

    setRepoItems((prev) =>
      prev.map((r) => (r.id === repo.id ? { ...r, status: "verifying" } : r)),
    );

    try {
      const res = await fetch(`/api/repos/${repo.id}/verify-local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPath: pathToVerify }),
      });

      const data = await res.json();

      if (data.verified && data.matchesRemote) {
        // Path verified and matches, trigger indexing
        setRepoItems((prev) =>
          prev.map((r) =>
            r.id === repo.id ? { ...r, status: "indexing", isCloned: true } : r,
          ),
        );

        // Trigger indexing
        await fetch(`/api/repos/${repo.id}/index`, { method: "POST" });
        return true;
      } else if (data.verified && !data.matchesRemote) {
        setRepoItems((prev) =>
          prev.map((r) =>
            r.id === repo.id
              ? {
                  ...r,
                  status: "error",
                  errorMessage: "Path exists but doesn't match this repository",
                }
              : r,
          ),
        );
        return false;
      } else {
        setRepoItems((prev) =>
          prev.map((r) =>
            r.id === repo.id
              ? {
                  ...r,
                  status: "error",
                  errorMessage: "Path not found or not a git repository",
                }
              : r,
          ),
        );
        return false;
      }
    } catch {
      setRepoItems((prev) =>
        prev.map((r) =>
          r.id === repo.id
            ? { ...r, status: "error", errorMessage: "Failed to verify path" }
            : r,
        ),
      );
      return false;
    }
  };

  const handleSetupAll = async () => {
    setIsProcessing(true);

    const pendingRepos = repoItems.filter(
      (r) => r.status === "pending" && (r.selectedPath || r.customPath),
    );

    for (const repo of pendingRepos) {
      await verifyAndSetPath(repo);
    }

    setIsProcessing(false);
  };

  const handleRetry = async (repoId: string) => {
    const repo = repoItems.find((r) => r.id === repoId);
    if (!repo) return;

    setRepoItems((prev) =>
      prev.map((r) =>
        r.id === repoId
          ? { ...r, status: "pending", errorMessage: undefined }
          : r,
      ),
    );

    await verifyAndSetPath(repo);
  };

  const allReposReady = repoItems.every(
    (r) => r.status === "ready" || r.status === "error",
  );
  const hasReadyRepos = repoItems.some((r) => r.status === "ready");
  const hasPendingSetup = repoItems.some(
    (r) => r.status === "pending" && (r.selectedPath || r.customPath),
  );

  const getStatusIcon = (status: RepoSetupItem["status"]) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "indexing":
      case "cloning":
      case "verifying":
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FolderSearch className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (item: RepoSetupItem) => {
    switch (item.status) {
      case "ready":
        return "Ready";
      case "indexing":
        return "Indexing...";
      case "cloning":
        return "Cloning...";
      case "verifying":
        return "Verifying...";
      case "error":
        return item.errorMessage || "Error";
      default:
        return "Select local path";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold tracking-tight">
                Setup Repositories
              </h2>
              <p className="text-sm text-muted-foreground">
                Point to your local clones for these repositories
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {repoItems.map((repo) => (
            <div
              key={repo.id}
              className={cn(
                "p-4 rounded-xl border transition-colors",
                repo.status === "ready"
                  ? "bg-green-500/5 border-green-500/20"
                  : repo.status === "error"
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-muted/30",
              )}
            >
              {/* Repo header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(repo.status)}
                  <span className="font-medium">{repo.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {repo.fullName}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    repo.status === "ready"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : repo.status === "error"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : repo.status === "indexing" ||
                            repo.status === "cloning" ||
                            repo.status === "verifying"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                  )}
                >
                  {getStatusText(repo)}
                </span>
              </div>

              {/* Path selection (only show when not ready/processing) */}
              {repo.status !== "ready" &&
                repo.status !== "indexing" &&
                repo.status !== "cloning" &&
                repo.status !== "verifying" && (
                  <div className="space-y-2">
                    {/* Suggested paths */}
                    {repo.suggestedPaths && repo.suggestedPaths.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                          Found on your machine:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {repo.suggestedPaths.map((path) => (
                            <button
                              key={path}
                              onClick={() => handlePathSelect(repo.id, path)}
                              className={cn(
                                "px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors",
                                repo.selectedPath === path && !repo.customPath
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-muted/50 border-border hover:border-primary/30",
                              )}
                            >
                              {path}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom path input */}
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Or enter custom path: ~/Projects/my-repo"
                        value={repo.customPath || ""}
                        onChange={(e) =>
                          handleCustomPathChange(repo.id, e.target.value)
                        }
                        className="font-mono text-sm"
                      />
                      {repo.status === "error" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(repo.id)}
                          className="flex-shrink-0"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t bg-muted/30 flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {repoItems.filter((r) => r.status === "ready").length} of{" "}
            {repoItems.length} repositories ready
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={allReposReady || hasReadyRepos ? onComplete : onClose}
              disabled={isProcessing}
            >
              {allReposReady || hasReadyRepos ? "Done" : "Skip for now"}
            </Button>
            {hasPendingSetup && (
              <Button
                onClick={handleSetupAll}
                disabled={isProcessing}
                className="gap-2 min-w-[140px]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <FolderGit2 className="w-4 h-4" />
                    Setup Selected
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
