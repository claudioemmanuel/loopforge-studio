/**
 * @vitest-environment jsdom
 */
import React, { createRef, useRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import type { Task } from "@/lib/db/schema";

// Mock the dependency highlight context
const mockContextValue = {
  hoveredTaskId: null as string | null,
  blockerIds: [] as string[],
  blockedByIds: [] as string[],
  dependencyChainIds: [] as string[],
  hasConnections: false,
  setHoveredTask: vi.fn(),
  isBlocker: vi.fn(() => false),
  isBlocked: vi.fn(() => false),
  isUnrelated: vi.fn(() => false),
  isInChain: vi.fn(() => false),
};

vi.mock("@/components/kanban/dependency-highlight-context", () => ({
  useDependencyHighlight: () => mockContextValue,
}));

// Import after mocks
import { DependencyLines } from "@/components/kanban/dependency-lines";

// Helper to create mock tasks
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).slice(2)}`,
  repoId: "repo-123",
  title: "Test Task",
  description: null,
  status: "todo",
  priority: 0,
  brainstormResult: null,
  planContent: null,
  branch: null,
  prTargetBranch: null,
  prDraft: null,
  prNumber: null,
  prUrl: null,
  blockedByIds: [],
  autoExecuteWhenUnblocked: false,
  dependencyPriority: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("DependencyLines", () => {
  let containerRef: React.RefObject<HTMLDivElement>;
  let containerElement: HTMLDivElement;
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset context mock to defaults (no hover, no connections)
    mockContextValue.hoveredTaskId = null;
    mockContextValue.blockerIds = [];
    mockContextValue.blockedByIds = [];
    mockContextValue.dependencyChainIds = [];
    mockContextValue.hasConnections = false;

    // Create container element with mock methods
    containerElement = document.createElement("div");
    containerElement.style.position = "relative";
    containerElement.style.width = "800px";
    containerElement.style.height = "600px";
    document.body.appendChild(containerElement);

    // Mock getBoundingClientRect
    containerElement.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    // Create ref
    containerRef = { current: containerElement };

    // Mock requestAnimationFrame
    rafCallback = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    if (containerElement.parentNode) {
      document.body.removeChild(containerElement);
    }
    vi.restoreAllMocks();
  });

  it("returns null when no task is hovered", () => {
    mockContextValue.hoveredTaskId = null;
    mockContextValue.hasConnections = false;

    const tasks = [createMockTask({ id: "task-1" })];
    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("returns null when hovered task has no connections", () => {
    mockContextValue.hoveredTaskId = "task-1";
    mockContextValue.hasConnections = false;
    mockContextValue.dependencyChainIds = ["task-1"];

    const tasks = [
      createMockTask({ id: "task-1", blockedByIds: [] }),
      createMockTask({ id: "task-2", blockedByIds: [] }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders SVG container when hovering a task with connections", () => {
    // Set up context for a task with connections
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];
    mockContextValue.blockerIds = ["task-1"];

    // Create task cards in the container
    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      right: 200,
      bottom: 150,
      width: 100,
      height: 50,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const task2Element = document.createElement("div");
    task2Element.setAttribute("data-task-id", "task-2");
    task2Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 300,
      right: 400,
      bottom: 150,
      width: 100,
      height: 50,
      x: 300,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task2Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({
        id: "task-2",
        status: "todo",
        blockedByIds: ["task-1"],
      }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    // Execute the RAF callback
    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("absolute");
    expect(svg).toHaveClass("inset-0");
    expect(svg).toHaveClass("pointer-events-none");
  });

  it("calculates paths between connected cards", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];
    mockContextValue.blockerIds = ["task-1"];

    // Create task cards
    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      right: 150,
      bottom: 150,
      width: 100,
      height: 50,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const task2Element = document.createElement("div");
    task2Element.setAttribute("data-task-id", "task-2");
    task2Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 300,
      right: 400,
      bottom: 150,
      width: 100,
      height: 50,
      x: 300,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task2Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({
        id: "task-2",
        status: "todo",
        blockedByIds: ["task-1"],
      }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();

    // Check that the path has proper SVG path commands
    const d = path?.getAttribute("d");
    expect(d).toContain("M"); // Move to
    expect(d).toContain("C"); // Cubic bezier
  });

  it("applies dotted line styling (strokeDasharray)", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];
    mockContextValue.blockerIds = ["task-1"];

    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      right: 150,
      bottom: 150,
      width: 100,
      height: 50,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const task2Element = document.createElement("div");
    task2Element.setAttribute("data-task-id", "task-2");
    task2Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 300,
      right: 400,
      bottom: 150,
      width: 100,
      height: 50,
      x: 300,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task2Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({
        id: "task-2",
        status: "todo",
        blockedByIds: ["task-1"],
      }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();

    // Check for dotted line styling (6 6 dash array)
    expect(path?.getAttribute("stroke-dasharray")).toBe("6 6");
    expect(path?.getAttribute("stroke-width")).toBe("2");
  });

  it("uses blocked task status color for line stroke", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];
    mockContextValue.blockerIds = ["task-1"];

    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      right: 150,
      bottom: 150,
      width: 100,
      height: 50,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const task2Element = document.createElement("div");
    task2Element.setAttribute("data-task-id", "task-2");
    task2Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 300,
      right: 400,
      bottom: 150,
      width: 100,
      height: 50,
      x: 300,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task2Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      // task-2 is in "planning" status - should use blue color
      createMockTask({
        id: "task-2",
        status: "planning",
        blockedByIds: ["task-1"],
      }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();

    // The stroke should be the planning status color (blue)
    const stroke = path?.getAttribute("stroke");
    expect(stroke).toBe("rgb(59, 130, 246)"); // blue-500
  });

  it("uses requestAnimationFrame for performance when hovering with connections", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({ id: "task-2", blockedByIds: ["task-1"] }),
    ];

    render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it("does not use requestAnimationFrame when no hover", () => {
    mockContextValue.hoveredTaskId = null;
    mockContextValue.hasConnections = false;

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({ id: "task-2", blockedByIds: ["task-1"] }),
    ];

    render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("renders arrow markers for each status in defs", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];
    mockContextValue.blockerIds = ["task-1"];

    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      right: 150,
      bottom: 150,
      width: 100,
      height: 50,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const task2Element = document.createElement("div");
    task2Element.setAttribute("data-task-id", "task-2");
    task2Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 300,
      right: 400,
      bottom: 150,
      width: 100,
      height: 50,
      x: 300,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task2Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({
        id: "task-2",
        status: "todo",
        blockedByIds: ["task-1"],
      }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    // Check for marker definitions for each status
    const defs = container.querySelector("defs");
    expect(defs).toBeInTheDocument();

    // Should have arrow markers for different statuses
    const todoMarker = container.querySelector("#arrowhead-todo");
    expect(todoMarker).toBeInTheDocument();

    const planningMarker = container.querySelector("#arrowhead-planning");
    expect(planningMarker).toBeInTheDocument();

    const executingMarker = container.querySelector("#arrowhead-executing");
    expect(executingMarker).toBeInTheDocument();
  });

  it("handles missing task elements gracefully", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];

    // Only add task-1 element, not task-2
    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      right: 150,
      bottom: 150,
      width: 100,
      height: 50,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({ id: "task-2", blockedByIds: ["task-1"] }),
    ];

    // Should not throw
    expect(() => {
      const { container } = render(
        <DependencyLines
          tasks={tasks}
          containerRef={containerRef as React.RefObject<HTMLElement>}
        />,
      );

      if (rafCallback) {
        act(() => {
          rafCallback!(0);
        });
      }
    }).not.toThrow();
  });

  it("only renders connections for tasks in the dependency chain", () => {
    mockContextValue.hoveredTaskId = "task-2";
    mockContextValue.hasConnections = true;
    // Only task-1 and task-2 are in the chain, not task-3
    mockContextValue.dependencyChainIds = ["task-1", "task-2"];
    mockContextValue.blockerIds = ["task-1"];

    // Create task elements
    const task1Element = document.createElement("div");
    task1Element.setAttribute("data-task-id", "task-1");
    task1Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      right: 150,
      bottom: 150,
      width: 100,
      height: 50,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task1Element);

    const task2Element = document.createElement("div");
    task2Element.setAttribute("data-task-id", "task-2");
    task2Element.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 300,
      right: 400,
      bottom: 150,
      width: 100,
      height: 50,
      x: 300,
      y: 100,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task2Element);

    const task3Element = document.createElement("div");
    task3Element.setAttribute("data-task-id", "task-3");
    task3Element.getBoundingClientRect = vi.fn(() => ({
      top: 200,
      left: 50,
      right: 150,
      bottom: 250,
      width: 100,
      height: 50,
      x: 50,
      y: 200,
      toJSON: () => ({}),
    }));
    containerElement.appendChild(task3Element);

    const tasks = [
      createMockTask({ id: "task-1" }),
      createMockTask({
        id: "task-2",
        status: "todo",
        blockedByIds: ["task-1"],
      }),
      // task-3 has a dependency but is NOT in the chain
      createMockTask({
        id: "task-3",
        status: "todo",
        blockedByIds: ["task-1"],
      }),
    ];

    const { container } = render(
      <DependencyLines
        tasks={tasks}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />,
    );

    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    // Should only have one path (task-1 -> task-2), not two
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
  });
});
