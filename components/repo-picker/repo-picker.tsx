"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Star,
  Lock,
  Globe,
  Building2,
  Check,
  Loader2,
} from "lucide-react";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string;
  };
}

type FilterType = "all" | "public" | "private" | "org";

interface RepoPickerProps {
  repos: GitHubRepo[];
  selectedRepos: Set<number>;
  onSelectionChange: (selection: Set<number>) => void;
  disabledRepoIds?: Set<number>;
  loading?: boolean;
}

export function RepoPicker({
  repos,
  selectedRepos,
  onSelectionChange,
  disabledRepoIds = new Set(),
  loading = false,
}: RepoPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const filtered = repos.filter((repo) => {
      const matchesSearch =
        searchQuery === "" ||
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
          false);

      const matchesFilter =
        filter === "all" ||
        (filter === "public" && !repo.private) ||
        (filter === "private" && repo.private) ||
        (filter === "org" && repo.owner.type === "Organization");

      return matchesSearch && matchesFilter;
    });

    const groups: Record<
      string,
      { owner: GitHubRepo["owner"]; repos: GitHubRepo[] }
    > = {};
    filtered.forEach((repo) => {
      if (!groups[repo.owner.login]) {
        groups[repo.owner.login] = { owner: repo.owner, repos: [] };
      }
      groups[repo.owner.login].repos.push(repo);
    });

    return Object.values(groups);
  }, [repos, searchQuery, filter]);

  const toggleRepo = (repoId: number) => {
    if (disabledRepoIds.has(repoId)) return;

    const next = new Set(selectedRepos);
    if (next.has(repoId)) {
      next.delete(repoId);
    } else {
      next.add(repoId);
    }
    onSelectionChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "public", "private", "org"] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(f)}
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

      {loading ? (
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
                {ownerRepos.map((repo) => {
                  const isDisabled = disabledRepoIds.has(repo.id);
                  const isSelected = selectedRepos.has(repo.id) || isDisabled;

                  return (
                    <button
                      key={repo.id}
                      onClick={() => toggleRepo(repo.id)}
                      disabled={isDisabled}
                      className={`w-full p-3 text-left rounded-lg border transition-all ${
                        isDisabled
                          ? "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                          : isSelected
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
                            {isDisabled && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                Already added
                              </span>
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
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
