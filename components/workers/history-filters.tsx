"use client";

import * as React from "react";
import { Search, X, Filter, ChevronDown, Lightbulb, FileText, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkerJobPhase } from "@/lib/db/schema";

export type HistoryStatusFilter = "all" | "completed" | "failed";
export type HistoryPhaseFilter = "all" | WorkerJobPhase;

export interface HistoryFiltersState {
  search: string;
  status: HistoryStatusFilter;
  phase: HistoryPhaseFilter;
  repoId?: string;
}

interface HistoryFiltersProps {
  filters: HistoryFiltersState;
  onFiltersChange: (filters: HistoryFiltersState) => void;
  totalCount: number;
  repos?: Array<{ id: string; name: string }>;
  className?: string;
}

const statusLabels: Record<HistoryStatusFilter, string> = {
  all: "All Status",
  completed: "Completed",
  failed: "Failed",
};

const phaseLabels: Record<HistoryPhaseFilter, string> = {
  all: "All Phases",
  brainstorming: "Brainstorm",
  planning: "Planning",
  executing: "Execution",
};

const phaseIcons: Record<WorkerJobPhase, React.ComponentType<{ className?: string }>> = {
  brainstorming: Lightbulb,
  planning: FileText,
  executing: Play,
};

const phaseColors: Record<WorkerJobPhase, string> = {
  brainstorming: "text-violet-500",
  planning: "text-blue-500",
  executing: "text-emerald-500",
};

/**
 * History Filters Component
 *
 * Provides search and filter controls for the history section:
 * - Search input with debounce
 * - Phase filter tabs (All | Brainstorming | Planning | Execution)
 * - Status filter pills
 * - Repository dropdown filter
 */
export function HistoryFilters({
  filters,
  onFiltersChange,
  totalCount,
  repos,
  className,
}: HistoryFiltersProps) {
  const [searchValue, setSearchValue] = React.useState(filters.search);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value });
    }, 300);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchValue("");
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    onFiltersChange({ ...filters, search: "" });
  };

  // Update status filter
  const handleStatusChange = (status: HistoryStatusFilter) => {
    onFiltersChange({ ...filters, status });
  };

  // Update phase filter
  const handlePhaseChange = (phase: HistoryPhaseFilter) => {
    onFiltersChange({ ...filters, phase });
  };

  // Update repo filter
  const handleRepoChange = (repoId: string | undefined) => {
    onFiltersChange({ ...filters, repoId });
  };

  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const selectedRepo = repos?.find((r) => r.id === filters.repoId);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header row with title and search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          History
          <span className="text-xs font-normal normal-case">({totalCount})</span>
        </h2>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(
              "h-9 w-full sm:w-64 pl-9 pr-8 rounded-lg border bg-background",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "transition-colors"
            )}
          />
          {searchValue && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Phase filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "brainstorming", "planning", "executing"] as HistoryPhaseFilter[]).map((phase) => {
          const PhaseIcon = phase !== "all" ? phaseIcons[phase as WorkerJobPhase] : null;
          const colorClass = phase !== "all" ? phaseColors[phase as WorkerJobPhase] : "";

          return (
            <button
              key={phase}
              onClick={() => handlePhaseChange(phase)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                filters.phase === phase
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
            >
              {PhaseIcon && (
                <PhaseIcon className={cn("w-3.5 h-3.5", filters.phase === phase ? "" : colorClass)} />
              )}
              {phaseLabels[phase]}
            </button>
          );
        })}
      </div>

      {/* Status filter pills and dropdown */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter pills */}
        {(["all", "completed", "failed"] as HistoryStatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              filters.status === status
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            )}
          >
            {statusLabels[status]}
          </button>
        ))}

        {/* Repository filter dropdown */}
        {repos && repos.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                {selectedRepo ? selectedRepo.name : "All Repos"}
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => handleRepoChange(undefined)}
                className={cn(!filters.repoId && "bg-muted")}
              >
                All Repositories
              </DropdownMenuItem>
              {repos.map((repo) => (
                <DropdownMenuItem
                  key={repo.id}
                  onClick={() => handleRepoChange(repo.id)}
                  className={cn(filters.repoId === repo.id && "bg-muted")}
                >
                  {repo.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Clear all filters */}
        {(filters.search || filters.status !== "all" || filters.phase !== "all" || filters.repoId) && (
          <button
            onClick={() => onFiltersChange({ search: "", status: "all", phase: "all", repoId: undefined })}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
