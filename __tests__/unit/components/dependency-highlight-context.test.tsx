/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { Task } from "@/lib/db/schema";
import {
  DependencyHighlightProvider,
  useDependencyHighlight,
} from "@/components/kanban/dependency-highlight-context";

// Helper to create mock tasks
const createMockTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: `task-${Math.random().toString(36).slice(2)}`,
    repoId: "repo-123",
    title: "Test Task",
    description: null,
    status: "todo",
    priority: 0,
    brainstormResult: null,
    brainstormConversation: null,
    brainstormSummary: null,
    brainstormMessageCount: 0,
    brainstormCompactedAt: null,
    planContent: null,
    branch: null,
    prTargetBranch: null,
    prDraft: null,
    autoApprove: false,
    autonomousMode: false,
    processingPhase: null,
    processingJobId: null,
    processingStartedAt: null,
    processingStatusText: null,
    processingProgress: 0,
    statusHistory: [],
    prNumber: null,
    prUrl: null,
    executionGraph: null,
    blockedByIds: [],
    autoExecuteWhenUnblocked: false,
    dependencyPriority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Task;

// Wrapper component for testing the hook
function TestComponent({ children }: { children: React.ReactNode }) {
  return <DependencyHighlightProvider>{children}</DependencyHighlightProvider>;
}

describe("DependencyHighlightContext", () => {
  describe("Provider Default Values", () => {
    it("provides default context values", () => {
      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      expect(result.current.hoveredTaskId).toBeNull();
      expect(result.current.blockerIds).toEqual([]);
      expect(result.current.blockedByIds).toEqual([]);
      expect(result.current.dependencyChainIds).toEqual([]);
      expect(result.current.hasConnections).toBe(false);
    });
  });

  describe("setHoveredTask", () => {
    it("updates blockerIds and blockedByIds correctly", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const task3 = createMockTask({
        id: "task-3",
        blockedByIds: ["task-2"],
      });
      const allTasks = [task1, task2, task3];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Hover over task-2 (blocked by task-1, blocks task-3)
      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      expect(result.current.hoveredTaskId).toBe("task-2");
      // task-1 blocks task-2
      expect(result.current.blockerIds).toContain("task-1");
      // task-3 is blocked by task-2
      expect(result.current.blockedByIds).toContain("task-3");
    });

    it("clears state when taskId is null", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const allTasks = [task1, task2];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Set hover state
      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      expect(result.current.hoveredTaskId).toBe("task-2");

      // Clear hover state
      act(() => {
        result.current.setHoveredTask(null);
      });

      expect(result.current.hoveredTaskId).toBeNull();
      expect(result.current.blockerIds).toEqual([]);
      expect(result.current.blockedByIds).toEqual([]);
      expect(result.current.dependencyChainIds).toEqual([]);
    });

    it("handles task with no dependencies", () => {
      const task1 = createMockTask({ id: "task-1", blockedByIds: [] });
      const allTasks = [task1];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      act(() => {
        result.current.setHoveredTask("task-1", task1, allTasks);
      });

      expect(result.current.hoveredTaskId).toBe("task-1");
      expect(result.current.blockerIds).toEqual([]);
      expect(result.current.blockedByIds).toEqual([]);
      expect(result.current.hasConnections).toBe(false);
    });
  });

  describe("isBlocker", () => {
    it("returns true for tasks that block the hovered task", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const allTasks = [task1, task2];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      expect(result.current.isBlocker("task-1")).toBe(true);
      expect(result.current.isBlocker("task-2")).toBe(false);
      expect(result.current.isBlocker("task-nonexistent")).toBe(false);
    });
  });

  describe("isBlocked", () => {
    it("returns true for tasks blocked by the hovered task", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const allTasks = [task1, task2];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Hover over task-1 (which blocks task-2)
      act(() => {
        result.current.setHoveredTask("task-1", task1, allTasks);
      });

      expect(result.current.isBlocked("task-2")).toBe(true);
      expect(result.current.isBlocked("task-1")).toBe(false);
    });
  });

  describe("isUnrelated", () => {
    it("returns true for tasks with no dependency relationship", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const task3 = createMockTask({ id: "task-3", blockedByIds: [] });
      const allTasks = [task1, task2, task3];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Hover over task-2 (blocked by task-1)
      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      // task-3 is unrelated to task-2
      expect(result.current.isUnrelated("task-3")).toBe(true);
      // task-1 is a blocker, not unrelated
      expect(result.current.isUnrelated("task-1")).toBe(false);
      // The hovered task itself is not unrelated
      expect(result.current.isUnrelated("task-2")).toBe(false);
    });

    it("returns false when no task is hovered", () => {
      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      expect(result.current.isUnrelated("task-1")).toBe(false);
    });
  });

  describe("isInChain", () => {
    it("returns true for tasks in the dependency chain", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const task3 = createMockTask({
        id: "task-3",
        blockedByIds: ["task-2"],
      });
      const task4 = createMockTask({ id: "task-4", blockedByIds: [] }); // Unrelated
      const allTasks = [task1, task2, task3, task4];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Hover over task-2 (in middle of chain)
      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      // All tasks in the chain should return true
      expect(result.current.isInChain("task-1")).toBe(true);
      expect(result.current.isInChain("task-2")).toBe(true);
      expect(result.current.isInChain("task-3")).toBe(true);
      // Unrelated task should return false
      expect(result.current.isInChain("task-4")).toBe(false);
    });
  });

  describe("hasConnections", () => {
    it("returns true when chain has 2+ tasks", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const allTasks = [task1, task2];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      expect(result.current.hasConnections).toBe(true);
    });

    it("returns false when task has no connections", () => {
      const task1 = createMockTask({ id: "task-1", blockedByIds: [] });
      const allTasks = [task1];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      act(() => {
        result.current.setHoveredTask("task-1", task1, allTasks);
      });

      expect(result.current.hasConnections).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useDependencyHighlight());
      }).toThrow(
        "useDependencyHighlight must be used within a DependencyHighlightProvider",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Complex dependency chains", () => {
    it("handles complex multi-level dependencies with full chain traversal", () => {
      // Create a chain: task-1 -> task-2 -> task-3 -> task-4
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({
        id: "task-2",
        blockedByIds: ["task-1"],
      });
      const task3 = createMockTask({
        id: "task-3",
        blockedByIds: ["task-2"],
      });
      const task4 = createMockTask({
        id: "task-4",
        blockedByIds: ["task-3"],
      });
      const allTasks = [task1, task2, task3, task4];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Hover over task-2
      act(() => {
        result.current.setHoveredTask("task-2", task2, allTasks);
      });

      // task-1 blocks task-2 (direct)
      expect(result.current.blockerIds).toContain("task-1");
      // task-3 is blocked by task-2 (direct)
      expect(result.current.blockedByIds).toContain("task-3");

      // Full chain should include all connected tasks
      expect(result.current.dependencyChainIds).toContain("task-1");
      expect(result.current.dependencyChainIds).toContain("task-2");
      expect(result.current.dependencyChainIds).toContain("task-3");
      expect(result.current.dependencyChainIds).toContain("task-4");
      expect(result.current.hasConnections).toBe(true);
    });

    it("handles tasks with multiple blockers", () => {
      const task1 = createMockTask({ id: "task-1" });
      const task2 = createMockTask({ id: "task-2" });
      const task3 = createMockTask({
        id: "task-3",
        blockedByIds: ["task-1", "task-2"],
      });
      const allTasks = [task1, task2, task3];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Hover over task-3
      act(() => {
        result.current.setHoveredTask("task-3", task3, allTasks);
      });

      expect(result.current.blockerIds).toContain("task-1");
      expect(result.current.blockerIds).toContain("task-2");
      expect(result.current.blockerIds).toHaveLength(2);
    });

    it("handles circular dependency prevention via visited set", () => {
      // This tests the edge case where tasks might have circular references
      // (even though the UI should prevent this, the algorithm should handle it)
      const task1 = createMockTask({ id: "task-1", blockedByIds: ["task-2"] });
      const task2 = createMockTask({ id: "task-2", blockedByIds: ["task-1"] });
      const allTasks = [task1, task2];

      const { result } = renderHook(() => useDependencyHighlight(), {
        wrapper: TestComponent,
      });

      // Should not cause infinite loop
      act(() => {
        result.current.setHoveredTask("task-1", task1, allTasks);
      });

      // Both tasks should be in the chain, but no infinite loop
      expect(result.current.dependencyChainIds).toHaveLength(2);
      expect(result.current.dependencyChainIds).toContain("task-1");
      expect(result.current.dependencyChainIds).toContain("task-2");
    });
  });
});
