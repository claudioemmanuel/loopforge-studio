"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { clientLogger } from "@/lib/logger";
import type {
  ActivityEvent,
  ActivitySummary,
  ActivityEventCategory,
} from "@/lib/db/schema";

export interface ActivityFilters {
  search: string;
  categories: ActivityEventCategory[];
  eventTypes: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

export interface UseActivityFeedOptions {
  repoId?: string;
  taskId?: string;
  userId?: string;
  initialFilters?: Partial<ActivityFilters>;
  pageSize?: number;
  enableLive?: boolean;
  livePollingInterval?: number;
}

export interface UseActivityFeedReturn {
  // Data
  events: ActivityEvent[];
  summaries: Map<string, ActivitySummary>;
  groupedByDay: Map<string, ActivityEvent[]>;

  // State
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;

  // Filters
  filters: ActivityFilters;
  setFilters: (filters: ActivityFilters) => void;

  // Live mode
  isLive: boolean;
  setIsLive: (enabled: boolean) => void;

  // Actions
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const DEFAULT_FILTERS: ActivityFilters = {
  search: "",
  categories: ["ai_action", "git", "system"],
  eventTypes: [],
  dateRange: { start: null, end: null },
};

export function useActivityFeed({
  repoId,
  taskId,
  userId,
  initialFilters,
  pageSize = 50,
  enableLive = true,
  livePollingInterval = 5000,
}: UseActivityFeedOptions = {}): UseActivityFeedReturn {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [summaries, setSummaries] = useState<Map<string, ActivitySummary>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<ActivityFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [isLive, setIsLive] = useState(enableLive);

  const offsetRef = useRef(0);
  const lastFetchTimeRef = useRef<Date | null>(null);

  // Build query params from filters
  const buildQueryParams = useCallback(
    (offset: number, limit: number): URLSearchParams => {
      const params = new URLSearchParams();

      if (repoId) params.set("repoId", repoId);
      if (taskId) params.set("taskId", taskId);
      if (userId) params.set("userId", userId);

      params.set("offset", offset.toString());
      params.set("limit", limit.toString());

      if (filters.search) {
        params.set("search", filters.search);
      }

      if (filters.categories.length < 3) {
        params.set("categories", filters.categories.join(","));
      }

      if (filters.eventTypes.length > 0) {
        params.set("eventTypes", filters.eventTypes.join(","));
      }

      if (filters.dateRange.start) {
        params.set("startDate", filters.dateRange.start.toISOString());
      }

      if (filters.dateRange.end) {
        params.set("endDate", filters.dateRange.end.toISOString());
      }

      return params;
    },
    [repoId, taskId, userId, filters],
  );

  // Fetch events
  const fetchEvents = useCallback(
    async (append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const offset = append ? offsetRef.current : 0;
        const params = buildQueryParams(offset, pageSize);

        const res = await fetch(`/api/activity?${params.toString()}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch activity: ${res.statusText}`);
        }

        const data = await res.json();
        const newEvents: ActivityEvent[] = data.events || [];

        if (append) {
          setEvents((prev) => [...prev, ...newEvents]);
          offsetRef.current += newEvents.length;
        } else {
          setEvents(newEvents);
          offsetRef.current = newEvents.length;
        }

        setHasMore(newEvents.length >= pageSize);
        lastFetchTimeRef.current = new Date();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        clientLogger.error("Error fetching activity events", { error: err });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [buildQueryParams, pageSize],
  );

  // Fetch summaries
  const fetchSummaries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (repoId) params.set("repoId", repoId);
      if (userId) params.set("userId", userId);
      if (filters.dateRange.start) {
        params.set("startDate", filters.dateRange.start.toISOString());
      }
      if (filters.dateRange.end) {
        params.set("endDate", filters.dateRange.end.toISOString());
      }

      const res = await fetch(`/api/activity/summary?${params.toString()}`);

      if (res.ok) {
        const data = await res.json();
        const summaryMap = new Map<string, ActivitySummary>();

        for (const summary of data.summaries || []) {
          const dateKey = new Date(summary.date).toDateString();
          summaryMap.set(dateKey, summary);
        }

        setSummaries(summaryMap);
      }
    } catch (err) {
      clientLogger.error("Error fetching activity summaries", { error: err });
    }
  }, [repoId, userId, filters.dateRange]);

  // Initial fetch
  useEffect(() => {
    fetchEvents(false);
    fetchSummaries();
  }, [fetchEvents, fetchSummaries]);

  // Re-fetch when filters change
  useEffect(() => {
    offsetRef.current = 0;
    fetchEvents(false);
  }, [filters, fetchEvents]);

  // Live polling
  useEffect(() => {
    if (!isLive) return;

    const pollForUpdates = async () => {
      if (!lastFetchTimeRef.current) return;

      try {
        const params = buildQueryParams(0, 20);
        params.set("since", lastFetchTimeRef.current.toISOString());

        const res = await fetch(`/api/activity?${params.toString()}`);

        if (res.ok) {
          const data = await res.json();
          const newEvents: ActivityEvent[] = data.events || [];

          if (newEvents.length > 0) {
            // Prepend new events (they're newer)
            setEvents((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const uniqueNew = newEvents.filter((e) => !existingIds.has(e.id));
              return [...uniqueNew, ...prev];
            });
            offsetRef.current += newEvents.length;
          }

          lastFetchTimeRef.current = new Date();
        }
      } catch (err) {
        clientLogger.error("Error polling for activity updates", {
          error: err,
        });
      }
    };

    const interval = setInterval(pollForUpdates, livePollingInterval);
    return () => clearInterval(interval);
  }, [isLive, buildQueryParams, livePollingInterval]);

  // Group events by day
  const groupedByDay = events.reduce((acc, event) => {
    const dateKey = new Date(event.createdAt).toDateString();
    const existing = acc.get(dateKey) || [];
    acc.set(dateKey, [...existing, event]);
    return acc;
  }, new Map<string, ActivityEvent[]>());

  // Public methods
  const refresh = useCallback(async () => {
    offsetRef.current = 0;
    await Promise.all([fetchEvents(false), fetchSummaries()]);
  }, [fetchEvents, fetchSummaries]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    await fetchEvents(true);
  }, [hasMore, isLoadingMore, fetchEvents]);

  return {
    events,
    summaries,
    groupedByDay,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    filters,
    setFilters,
    isLive,
    setIsLive,
    refresh,
    loadMore,
  };
}
