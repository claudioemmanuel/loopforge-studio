"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Search,
  Star,
  Lock,
  Globe,
  Building2,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { GitHubRepo, FilterType } from "./onboarding-config";
import { STRIPE_PLANS } from "@/lib/stripe/client";

export function StepRepos({
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  fetchingRepos,
  repos,
  groupedRepos,
  selectedRepos,
  onToggleRepo,
  onContinue,
  onBack,
  formatDate,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  fetchingRepos: boolean;
  repos: GitHubRepo[];
  groupedRepos: Array<{ owner: GitHubRepo["owner"]; repos: GitHubRepo[] }>;
  selectedRepos: Set<number>;
  onToggleRepo: (repoId: number) => void;
  onContinue: () => void;
  onBack: () => void;
  formatDate: (dateString: string) => string;
}) {
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // Assume free tier during onboarding (default tier)
  const userTier = "free" as const;
  const maxRepos = STRIPE_PLANS[userTier].maxRepos;

  const handleRepoToggle = (repoId: number) => {
    const isCurrentlySelected = selectedRepos.has(repoId);

    if (!isCurrentlySelected) {
      // Check limit BEFORE adding (free tier has fixed limit of 1)
      if (selectedRepos.size >= maxRepos) {
        setLimitWarning(
          `Free tier allows only ${maxRepos} ${maxRepos === 1 ? "repository" : "repositories"}. Upgrade to Pro for ${STRIPE_PLANS.pro.maxRepos} repositories.`,
        );
        return;
      }
    }

    setLimitWarning(null);
    onToggleRepo(repoId);
  };

  return (
    <div className="space-y-4">
      {/* Show limit info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <span className="font-medium">Your plan:</span> {userTier} tier -{" "}
          {maxRepos} {maxRepos === 1 ? "repository" : "repositories"}
        </p>
        <Link
          href="/billing"
          className="text-sm text-blue-600 hover:underline inline-block mt-1"
        >
          Upgrade to Pro for 20 repositories →
        </Link>
      </div>

      {/* Show warning when limit reached */}
      {limitWarning && (
        <Alert
          variant="default"
          className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-900 dark:text-yellow-100">
            Repository limit reached
          </AlertTitle>
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            {limitWarning}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "public", "private", "org"] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onFilterChange(f)}
              className="capitalize"
            >
              {f === "org" ? (
                <Building2 className="w-4 h-4 mr-1" />
              ) : f === "private" ? (
                <Lock className="w-4 h-4 mr-1" />
              ) : f === "public" ? (
                <Globe className="w-4 h-4 mr-1" />
              ) : null}
              {f}
            </Button>
          ))}
        </div>
      </div>

      {fetchingRepos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : groupedRepos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {repos.length === 0
            ? "No repositories found"
            : "No repositories match your search"}
        </div>
      ) : (
        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
          {groupedRepos.map(({ owner, repos: ownerRepos }) => (
            <div key={owner.login} className="space-y-2">
              <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                <Image
                  src={owner.avatar_url}
                  alt={owner.login}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <span className="text-sm font-medium">{owner.login}</span>
                {owner.type === "Organization" && (
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-1 ml-7">
                {ownerRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleRepoToggle(repo.id)}
                    className={`w-full p-3 text-left rounded-lg border transition-all ${
                      selectedRepos.has(repo.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {repo.name}
                          </span>
                          {repo.private ? (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-primary" />
                              {repo.language}
                            </span>
                          )}
                          {repo.stargazers_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              {repo.stargazers_count}
                            </span>
                          )}
                          <span>Updated {formatDate(repo.updated_at)}</span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedRepos.has(repo.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedRepos.has(repo.id) && (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {selectedRepos.size === 0
            ? "No repositories selected"
            : `${selectedRepos.size} ${selectedRepos.size === 1 ? "repository" : "repositories"} selected`}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onContinue} disabled={selectedRepos.size === 0}>
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
