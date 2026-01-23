"use client";

import * as React from "react";
import Link from "next/link";
import { History, Clock, FileText, Terminal, GitCommit, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HistoryCard,
  HistoryCardSkeleton,
  type HistoryItemData,
} from "./history-card";

// Re-export the type for convenience
export type { HistoryItemData };
import {
  HistoryFilters,
  type HistoryFiltersState,
} from "./history-filters";

interface HistorySectionProps {
  /** History items to display */
  items: HistoryItemData[];
  /** Whether data is loading */
  loading?: boolean;
  /** Total count of items (for display in header) */
  totalCount?: number;
  /** Available repositories for filtering */
  repos?: Array<{ id: string; name: string }>;
  /** Callback when retry is clicked */
  onRetry?: (taskId: string) => void;
  /** Callback to load more items */
  onLoadMore?: () => void;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Whether more items are being loaded */
  loadingMore?: boolean;
  className?: string;
}

/**
 * History Section Component
 *
 * Container for worker execution history with:
 * - Filters (search, status, repo)
 * - List of HistoryCards
 * - Load more / pagination
 * - Empty state
 */
export function HistorySection({
  items,
  loading = false,
  totalCount,
  repos,
  onRetry,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  className,
}: HistorySectionProps) {
  const [filters, setFilters] = React.useState<HistoryFiltersState>({
    search: "",
    status: "all",
    repoId: undefined,
  });

  // Filter items based on current filters
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (filters.status !== "all" && item.status !== filters.status) {
        return false;
      }

      // Repo filter
      if (filters.repoId && item.repoId !== filters.repoId) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = item.taskTitle.toLowerCase().includes(searchLower);
        const matchesRepo = item.repoName.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesRepo) {
          return false;
        }
      }

      return true;
    });
  }, [items, filters]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Section header */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <History className="w-4 h-4" />
        Execution History
      </h2>

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="space-y-4">
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
        </div>
      )}

      {/* Empty state when no history at all */}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8">
          <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">No execution history yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Completed tasks will appear here showing what was done:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 text-left mb-6">
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Files modified</span>
              </li>
              <li className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-500" />
                <span>Commands executed</span>
              </li>
              <li className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-green-500" />
                <span>Commits created</span>
              </li>
              <li className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-500" />
                <span>AI reasoning steps</span>
              </li>
            </ul>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Go to Task Board
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Filters - only show when there are items */}
      {items.length > 0 && (
        <HistoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          totalCount={totalCount ?? items.length}
          repos={repos}
        />
      )}

      {/* History cards list */}
      {!loading && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}

      {/* Empty state for filtered results */}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <History className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No history matches your filters
          </p>
          <button
            onClick={() => setFilters({ search: "", status: "all", repoId: undefined })}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Load more button */}
      {!loading && hasMore && onLoadMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Empty state when no history exists
 */
export function HistoryEmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <History className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-foreground mb-1">No history yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Completed tasks will appear here with details about their execution.
      </p>
    </div>
  );
}
