"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { clientLogger } from "@/lib/logger";
import {
  History,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Lightbulb,
  FileText,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HistoryCard,
  HistoryCardSkeleton,
  type HistoryItemData,
} from "@/components/workers/history-card";
import {
  HistoryFilters,
  type HistoryFiltersState,
} from "@/components/workers/history-filters";
import type { WorkerJobPhase } from "@/lib/db/schema";

interface HistoryStats {
  total: number;
  completed: number;
  failed: number;
  brainstorming: number;
  planning: number;
  executing: number;
}

interface HistoryResponse {
  items: Array<HistoryItemData & { startedAt: string; completedAt?: string }>;
  stats: HistoryStats;
  page: number;
  hasMore: boolean;
}

interface Repo {
  id: string;
  name: string;
}

function formatAvgDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export default function WorkersHistoryPage() {
  const [items, setItems] = useState<HistoryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<HistoryStats>({
    total: 0,
    completed: 0,
    failed: 0,
    brainstorming: 0,
    planning: 0,
    executing: 0,
  });
  const [hasMore, setHasMore] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [filters, setFilters] = useState<HistoryFiltersState>({
    search: "",
    status: "all",
    phase: "all",
    repoId: undefined,
  });

  // Fetch history data
  const fetchHistory = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "20",
        });

        if (filters.status !== "all") {
          params.set("status", filters.status);
        }
        if (filters.phase !== "all") {
          params.set("phase", filters.phase);
        }
        if (filters.search) {
          params.set("search", filters.search);
        }
        if (filters.repoId) {
          params.set("repoId", filters.repoId);
        }

        const res = await fetch(`/api/workers/history?${params}`);
        if (res.ok) {
          const data: HistoryResponse = await res.json();
          const parsedItems: HistoryItemData[] = data.items.map((item) => ({
            ...item,
            startedAt: new Date(item.startedAt),
            completedAt: item.completedAt
              ? new Date(item.completedAt)
              : undefined,
          }));

          if (append) {
            setItems((prev) => [...prev, ...parsedItems]);
          } else {
            setItems(parsedItems);
          }

          setStats(data.stats);
          setHasMore(data.hasMore);
          setPage(pageNum);
        }
      } catch (err) {
        clientLogger.error("Error fetching history", { error: err });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters],
  );

  // Fetch repos for filter dropdown
  useEffect(() => {
    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        if (res.ok) {
          const data = await res.json();
          setRepos(
            data.map((r: { id: string; name: string }) => ({
              id: r.id,
              name: r.name,
            })),
          );
        }
      } catch (err) {
        clientLogger.error("Error fetching repos", { error: err });
      }
    }
    fetchRepos();
  }, []);

  // Load history on mount and when filters change
  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchHistory(page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchHistory]);

  // Handle retry
  const handleRetry = async (taskId: string) => {
    try {
      await fetch(`/api/workers/${taskId}/retry`, { method: "POST" });
      fetchHistory(1);
    } catch (err) {
      clientLogger.error("Failed to retry task", { error: err });
    }
  };

  // Calculate average duration from items
  const avgDuration = useMemo(() => {
    const itemsWithDuration = items.filter((i) => i.duration !== undefined);
    if (itemsWithDuration.length === 0) return 0;
    return (
      itemsWithDuration.reduce((sum, i) => sum + (i.duration || 0), 0) /
      itemsWithDuration.length
    );
  }, [items]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Worker History
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse all background processing jobs
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchHistory(1)}
          title="Refresh history"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats bar - now with phase breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <div>
            <p className="text-2xl font-bold">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <div>
            <p className="text-2xl font-bold">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border">
          <Timer className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">
              {avgDuration > 0 ? formatAvgDuration(avgDuration) : "-"}
            </p>
            <p className="text-xs text-muted-foreground">Avg Time</p>
          </div>
        </div>
        {/* Phase breakdown */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary border">
          <Lightbulb className="w-5 h-5 text-secondary-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.brainstorming}</p>
            <p className="text-xs text-muted-foreground">Brainstorm</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary border">
          <FileText className="w-5 h-5 text-secondary-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.planning}</p>
            <p className="text-xs text-muted-foreground">Planning</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <Play className="w-5 h-5 text-primary" />
          <div>
            <p className="text-2xl font-bold">{stats.executing}</p>
            <p className="text-xs text-muted-foreground">Execution</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <HistoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          totalCount={stats.total}
          repos={repos}
        />
      </div>

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="space-y-4">
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No history yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Completed brainstorming, planning, and execution jobs will appear
            here with details about their processing.
          </p>
        </div>
      )}

      {/* History list */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <HistoryCard key={item.id} item={item} onRetry={handleRetry} />
          ))}
        </div>
      )}

      {/* Load more button */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-6">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? "Loading..."
              : `Load more (${items.length} of ${stats.total})`}
          </Button>
        </div>
      )}
    </div>
  );
}
