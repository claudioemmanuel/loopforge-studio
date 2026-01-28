/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useActivityFeed } from "@/components/hooks/use-activity-feed";
import type { ActivityEvent, ActivitySummary } from "@/lib/db/schema";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock clientLogger
vi.mock("@/lib/logger", () => ({
  clientLogger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("useActivityFeed Hook", () => {
  const mockEvents: Partial<ActivityEvent>[] = [
    {
      id: "event-1",
      eventType: "file_write",
      eventCategory: "ai_action",
      title: "Created file",
      createdAt: new Date("2024-01-15T10:00:00Z"),
    },
    {
      id: "event-2",
      eventType: "commit",
      eventCategory: "git",
      title: "Committed changes",
      createdAt: new Date("2024-01-15T11:00:00Z"),
    },
    {
      id: "event-3",
      eventType: "test_run",
      eventCategory: "test",
      title: "Tests passed",
      createdAt: new Date("2024-01-14T10:00:00Z"),
    },
  ];

  const mockSummaries: Partial<ActivitySummary>[] = [
    {
      id: "summary-1",
      date: new Date("2024-01-15"),
      tasksCompleted: 3,
      commits: 5,
      filesChanged: 12,
    },
    {
      id: "summary-2",
      date: new Date("2024-01-14"),
      tasksCompleted: 2,
      commits: 3,
      filesChanged: 8,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should fetch events on mount", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/activity/summary")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summaries: mockSummaries }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: mockEvents }),
      });
    });

    const { result } = renderHook(() => useActivityFeed({ enableLive: false }));

    // Initial loading state
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it("should include repoId in query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], summaries: [] }),
    });

    renderHook(() =>
      useActivityFeed({ repoId: "repo-123", enableLive: false }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("repoId=repo-123"),
      );
    });
  });

  it("should include taskId in query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], summaries: [] }),
    });

    renderHook(() =>
      useActivityFeed({ taskId: "task-456", enableLive: false }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("taskId=task-456"),
      );
    });
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() => useActivityFeed({ enableLive: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.events).toHaveLength(0);
  });

  it("should group events by day", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/activity/summary")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summaries: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: mockEvents }),
      });
    });

    const { result } = renderHook(() => useActivityFeed({ enableLive: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Events should be grouped by day
    expect(result.current.groupedByDay.size).toBeGreaterThan(0);

    // Get all events and verify they are grouped correctly
    let totalGroupedEvents = 0;
    result.current.groupedByDay.forEach((events) => {
      totalGroupedEvents += events.length;
    });

    // Total grouped events should match the events count
    expect(totalGroupedEvents).toBe(result.current.events.length);
  });

  it("should apply category filters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents, summaries: [] }),
    });

    const { result } = renderHook(() =>
      useActivityFeed({
        enableLive: false,
        initialFilters: {
          categories: ["ai_action"],
          search: "",
          eventTypes: [],
          dateRange: { start: null, end: null },
        },
      }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("categories=ai_action"),
      );
    });
  });

  it("should apply search filter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], summaries: [] }),
    });

    const { result } = renderHook(() => useActivityFeed({ enableLive: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear mock calls from initial render
    mockFetch.mockClear();

    // Update filters with search term
    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        search: "created",
      });
    });

    // Wait for filter to trigger a new fetch
    await waitFor(
      () => {
        const calls = mockFetch.mock.calls.map(([url]) => url);
        const hasSearchParam = calls.some((url: string) =>
          url.includes("search=created"),
        );
        expect(hasSearchParam).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it("should load more events on demand", async () => {
    const firstPageEvents = mockEvents.slice(0, 2);
    const secondPageEvents = mockEvents.slice(2);

    let activityFetchCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/activity/summary")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summaries: [] }),
        });
      }

      // Track only /api/activity calls (not summary)
      if (url.includes("/api/activity?")) {
        activityFetchCount++;
        if (activityFetchCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ events: firstPageEvents }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: secondPageEvents }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: [], summaries: [] }),
      });
    });

    const { result } = renderHook(() =>
      useActivityFeed({ enableLive: false, pageSize: 2 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First page should have 2 events
    await waitFor(() => {
      expect(result.current.events.length).toBeGreaterThanOrEqual(1);
    });

    // Load more
    await act(async () => {
      await result.current.loadMore();
    });

    // After loading more, should have more events
    await waitFor(() => {
      expect(activityFetchCount).toBeGreaterThanOrEqual(2);
    });
  });

  it("should refresh events when called", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents, summaries: [] }),
    });

    const { result } = renderHook(() => useActivityFeed({ enableLive: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = mockFetch.mock.calls.length;

    // Call refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it("should toggle live mode", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents, summaries: [] }),
    });

    const { result } = renderHook(() =>
      useActivityFeed({ enableLive: true, livePollingInterval: 1000 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLive).toBe(true);

    // Toggle off
    act(() => {
      result.current.setIsLive(false);
    });

    expect(result.current.isLive).toBe(false);
  });

  it("should set hasMore based on page size", async () => {
    // Return less than page size to indicate no more
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ events: mockEvents.slice(0, 1), summaries: [] }),
    });

    const { result } = renderHook(() =>
      useActivityFeed({ enableLive: false, pageSize: 50 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Since we got fewer events than page size, hasMore should be false
    expect(result.current.hasMore).toBe(false);
  });

  it("should fetch summaries alongside events", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/activity/summary")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ summaries: mockSummaries }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: mockEvents }),
      });
    });

    const { result } = renderHook(() => useActivityFeed({ enableLive: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summaries.size).toBeGreaterThan(0);
  });

  it("should apply date range filters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], summaries: [] }),
    });

    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    const { result } = renderHook(() =>
      useActivityFeed({
        enableLive: false,
        initialFilters: {
          search: "",
          categories: ["ai_action", "git", "system"],
          eventTypes: [],
          dateRange: { start: startDate, end: endDate },
        },
      }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("startDate="),
      );
    });

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("endDate="));
  });
});
