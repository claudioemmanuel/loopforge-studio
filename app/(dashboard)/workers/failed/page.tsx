"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HistoryCard,
  HistoryCardSkeleton,
  type HistoryItemData,
} from "@/components/workers/history-card";

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

export default function WorkersFailedPage() {
  const [items, setItems] = useState<HistoryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Fetch failed/stuck tasks
  const fetchFailed = useCallback(
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
          status: "failed",
        });

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

          setTotal(data.stats.failed);
          setHasMore(data.hasMore);
          setPage(pageNum);
        }
      } catch (err) {
        console.error("Error fetching failed tasks:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Load on mount
  useEffect(() => {
    fetchFailed(1);
  }, [fetchFailed]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchFailed(page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchFailed]);

  // Handle retry
  const handleRetry = async (taskId: string) => {
    try {
      await fetch(`/api/workers/${taskId}/retry`, { method: "POST" });
      // Remove from list optimistically
      setItems((prev) => prev.filter((i) => i.taskId !== taskId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to retry:", err);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            Failed Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            Tasks that got stuck or encountered errors
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchFailed(1)}
          title="Refresh failed tasks"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 mb-6">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <div>
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Failed tasks requiring attention</p>
        </div>
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
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No failed tasks</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            All your tasks are running smoothly. Failed or stuck tasks will
            appear here when they need your attention.
          </p>
        </div>
      )}

      {/* Failed tasks list */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onRetry={handleRetry}
              defaultExpanded
            />
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
            {loadingMore ? "Loading..." : `Load more (${items.length} of ${total})`}
          </Button>
        </div>
      )}
    </div>
  );
}
