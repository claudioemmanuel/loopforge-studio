/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskDependencies } from "@/components/hooks/use-task-dependencies";
import type { Task, TaskDependency } from "@/lib/db/schema";

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

describe("useTaskDependencies Hook", () => {
  const mockBlocker: Partial<Task> = {
    id: "blocker-1",
    title: "Blocker Task",
    status: "executing",
  };

  const mockBlocker2: Partial<Task> = {
    id: "blocker-2",
    title: "Another Blocker",
    status: "done",
  };

  const mockBlockedTask: Partial<Task> = {
    id: "blocked-1",
    title: "Blocked Task",
    status: "todo",
  };

  const mockDependency: Partial<TaskDependency> = {
    id: "dep-1",
    taskId: "task-123",
    blockedById: "blocker-1",
    createdAt: new Date(),
  };

  const mockAvailableTasks: Partial<Task>[] = [
    { id: "available-1", title: "Available Task 1", status: "todo" },
    { id: "available-2", title: "Available Task 2", status: "done" },
  ];

  const mockApiResponse = {
    blockedBy: [{ dependency: mockDependency, task: mockBlocker }],
    blocks: [
      { dependency: { ...mockDependency, id: "dep-2" }, task: mockBlockedTask },
    ],
    availableTasks: mockAvailableTasks,
    autoExecuteWhenUnblocked: true,
    dependencyPriority: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch dependencies on mount", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-123/dependencies");
    expect(result.current.blockedBy).toHaveLength(1);
    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.availableTasks).toHaveLength(2);
    expect(result.current.autoExecuteWhenUnblocked).toBe(true);
    expect(result.current.dependencyPriority).toBe(5);
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.blockedBy).toHaveLength(0);
  });

  it("should add a dependency", async () => {
    mockFetch
      // Initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockApiResponse, blockedBy: [] }),
      })
      // POST to add dependency
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDependency),
      })
      // Refresh after add
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.blockedBy).toHaveLength(0);

    // Add dependency
    let success = false;
    await act(async () => {
      success = await result.current.addDependency("blocker-1");
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-123/dependencies",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ blockedById: "blocker-1" }),
      }),
    );
  });

  it("should remove a dependency", async () => {
    mockFetch
      // Initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
      // DELETE to remove dependency
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      // Refresh after remove
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockApiResponse, blockedBy: [] }),
      });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.blockedBy).toHaveLength(1);

    // Remove dependency
    let success = false;
    await act(async () => {
      success = await result.current.removeDependency("blocker-1");
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-123/dependencies",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ blockedById: "blocker-1" }),
      }),
    );
  });

  it("should update autoExecuteWhenUnblocked setting", async () => {
    mockFetch
      // Initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockApiResponse,
            autoExecuteWhenUnblocked: false,
          }),
      })
      // PATCH to update setting
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, autoExecuteWhenUnblocked: true }),
      });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.autoExecuteWhenUnblocked).toBe(false);

    // Update setting
    let success = false;
    await act(async () => {
      success = await result.current.setAutoExecuteWhenUnblocked(true);
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-123/dependencies",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ autoExecuteWhenUnblocked: true }),
      }),
    );
    expect(result.current.autoExecuteWhenUnblocked).toBe(true);
  });

  it("should update dependencyPriority setting", async () => {
    mockFetch
      // Initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockApiResponse, dependencyPriority: 0 }),
      })
      // PATCH to update priority
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, dependencyPriority: 10 }),
      });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.dependencyPriority).toBe(0);

    // Update priority
    let success = false;
    await act(async () => {
      success = await result.current.setDependencyPriority(10);
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-123/dependencies",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ dependencyPriority: 10 }),
      }),
    );
    expect(result.current.dependencyPriority).toBe(10);
  });

  it("should handle add dependency failure", async () => {
    mockFetch
      // Initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
      // POST fails
      .mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Would create circular dependency" }),
      });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Try to add dependency (should fail)
    let success = true;
    await act(async () => {
      success = await result.current.addDependency("blocker-1");
    });

    expect(success).toBe(false);
  });

  it("should refresh dependencies on demand", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = mockFetch.mock.calls.length;

    // Manually refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it("should refetch when taskId changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    const { result, rerender } = renderHook(
      ({ taskId }) => useTaskDependencies({ taskId, repoId: "repo-456" }),
      { initialProps: { taskId: "task-123" } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-123/dependencies");

    // Change taskId
    rerender({ taskId: "task-789" });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tasks/task-789/dependencies",
      );
    });
  });

  it("should return empty arrays when API returns null", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          blockedBy: null,
          blocks: null,
          availableTasks: null,
          autoExecuteWhenUnblocked: null,
          dependencyPriority: null,
        }),
    });

    const { result } = renderHook(() =>
      useTaskDependencies({ taskId: "task-123", repoId: "repo-456" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.blockedBy).toEqual([]);
    expect(result.current.blocks).toEqual([]);
    expect(result.current.availableTasks).toEqual([]);
    expect(result.current.autoExecuteWhenUnblocked).toBe(false);
    expect(result.current.dependencyPriority).toBe(0);
  });
});
