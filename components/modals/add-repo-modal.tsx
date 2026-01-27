"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RepoPicker, GitHubRepo } from "@/components/repo-picker";
import { RepoSetupModal } from "@/components/modals/repo-setup-modal";
import { X, FolderPlus, Loader2, AlertCircle } from "lucide-react";

interface RepoNeedingSetup {
  id: string;
  name: string;
  fullName: string;
  suggestedPaths?: string[];
}

interface AddRepoModalProps {
  existingRepoGithubIds: Set<number>;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRepoModal({
  existingRepoGithubIds,
  onClose,
  onSuccess,
}: AddRepoModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [fetchingRepos, setFetchingRepos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reposNeedingSetup, setReposNeedingSetup] = useState<
    RepoNeedingSetup[]
  >([]);
  const [showSetupModal, setShowSetupModal] = useState(false);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setFetchingRepos(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repositories");
      }
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFetchingRepos(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedRepos.size === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const selectedReposList = repos.filter((r) => selectedRepos.has(r.id));

      const res = await fetch("/api/repos/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: selectedReposList }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add repositories");
      }

      const result = await res.json();

      // Check which repos need local setup
      const reposToSetup: RepoNeedingSetup[] = [];

      for (const repoId of result.repoIds) {
        try {
          // Search for existing local clones
          const verifyRes = await fetch(`/api/repos/${repoId}/verify-local`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ searchCommonPaths: true }),
          });

          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();

            // Find the repo name from our selected list
            const repoInfo = selectedReposList.find((r) =>
              result.addedRepos.includes(r.full_name),
            );

            if (!verifyData.verified) {
              // Repo not found locally, needs setup
              reposToSetup.push({
                id: repoId,
                name: repoInfo?.name || "Unknown",
                fullName: repoInfo?.full_name || "Unknown",
                suggestedPaths: verifyData.suggestedPaths || [],
              });
            }
          }
        } catch {
          // If verification fails, still add to setup list
          const repoInfo = selectedReposList.find((r) =>
            result.addedRepos.includes(r.full_name),
          );
          reposToSetup.push({
            id: repoId,
            name: repoInfo?.name || "Unknown",
            fullName: repoInfo?.full_name || "Unknown",
            suggestedPaths: [],
          });
        }
      }

      if (reposToSetup.length > 0) {
        setReposNeedingSetup(reposToSetup);
        setShowSetupModal(true);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    onSuccess();
  };

  // Count new repos (not already connected)
  const newRepoCount = selectedRepos.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl overflow-hidden bg-card rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold tracking-tight">
                Add Repository
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect more GitHub repositories to Loopforge
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
        <div className="p-6">
          {error && (
            <div className="flex items-start gap-3 p-4 mb-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200/50 dark:border-red-800/30 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Error</p>
                <p className="text-sm opacity-80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <RepoPicker
            repos={repos}
            selectedRepos={selectedRepos}
            onSelectionChange={setSelectedRepos}
            disabledRepoIds={existingRepoGithubIds}
            loading={fetchingRepos}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {newRepoCount === 0
              ? "No repositories selected"
              : `${newRepoCount} ${newRepoCount === 1 ? "repository" : "repositories"} selected`}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={newRepoCount === 0 || submitting}
              className="gap-2 min-w-[120px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  Add Selected
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Repo Setup Modal */}
      {showSetupModal && reposNeedingSetup.length > 0 && (
        <RepoSetupModal
          repos={reposNeedingSetup}
          onClose={() => {
            setShowSetupModal(false);
            onSuccess();
          }}
          onComplete={handleSetupComplete}
        />
      )}
    </div>
  );
}
