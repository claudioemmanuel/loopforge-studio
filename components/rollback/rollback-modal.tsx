"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  RotateCcw,
  Loader2,
  AlertTriangle,
  GitCommit,
  Check,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommitInfo {
  sha: string;
  message: string;
  filesChanged: string[] | null;
  isReverted: boolean;
  createdAt: string;
}

interface RollbackModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onRollback: () => Promise<void>;
}

export function RollbackModal({
  taskId,
  isOpen,
  onClose,
  onRollback,
}: RollbackModalProps) {
  const [loading, setLoading] = useState(true);
  const [canRollback, setCanRollback] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkRollback();
    }
  }, [isOpen, taskId]);

  const checkRollback = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/rollback/check`);
      if (!res.ok) {
        throw new Error("Failed to check rollback status");
      }
      const data = await res.json();
      setCanRollback(data.canRollback);
      setReason(data.reason);
      setCommits(data.commits || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check rollback status",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    setRolling(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rollbackReason || "Rollback requested",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rollback");
      }
      await onRollback();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rollback");
    } finally {
      setRolling(false);
    }
  };

  if (!isOpen) return null;

  const activeCommits = commits.filter((c) => !c.isReverted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <RotateCcw className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Rollback Changes</h2>
              <p className="text-sm text-muted-foreground">
                Revert commits made by this task
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button
                onClick={checkRollback}
                variant="outline"
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          ) : !canRollback ? (
            <div className="flex flex-col items-center py-8 text-center">
              <XCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {reason || "Cannot rollback"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Warning */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    This action will revert all commits made by this task
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    A new revert commit will be created. This cannot be undone
                    easily.
                  </p>
                </div>
              </div>

              {/* Commits to revert */}
              {activeCommits.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">
                    Commits to revert ({activeCommits.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeCommits.map((commit) => (
                      <div
                        key={commit.sha}
                        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <GitCommit className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-muted-foreground">
                            {commit.sha.slice(0, 7)}
                          </p>
                          <p className="text-sm truncate">{commit.message}</p>
                          {commit.filesChanged && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {commit.filesChanged.length} file
                              {commit.filesChanged.length !== 1 ? "s" : ""}{" "}
                              changed
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason input */}
              <div>
                <label
                  htmlFor="rollback-reason"
                  className="block text-sm font-medium mb-2"
                >
                  Reason for rollback (optional)
                </label>
                <textarea
                  id="rollback-reason"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Why are you rolling back these changes?"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && canRollback && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <Button variant="outline" onClick={onClose} disabled={rolling}>
              Cancel
            </Button>
            <Button
              onClick={handleRollback}
              disabled={rolling || activeCommits.length === 0}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {rolling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Rollback {activeCommits.length} commit
              {activeCommits.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
