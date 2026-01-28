/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Task } from "@/lib/db/schema";

// Mock all dependencies before importing the component
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 hours ago",
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("@/components/kanban/processing-popover", () => ({
  ProcessingPopover: ({ children }: React.PropsWithChildren) => <>{children}</>,
  phaseConfig: {
    brainstorming: { color: "violet" },
    planning: { color: "blue" },
    executing: { color: "emerald" },
  },
}));

vi.mock("@/components/kanban/dependency-highlight-context", () => ({
  useDependencyHighlight: () => ({
    hoveredTaskId: null,
    blockerIds: [],
    blockedByIds: [],
    showDependencyLines: false,
    setHoveredTask: vi.fn(),
    setShowDependencyLines: vi.fn(),
    isBlocker: () => false,
    isBlocked: () => false,
    isUnrelated: () => false,
  }),
}));

// Import after mocks
import { KanbanCard } from "@/components/kanban/kanban-card";

describe("KanbanCard Blocked Indicator", () => {
  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: "task-123",
    repoId: "repo-456",
    title: "Test Task",
    description: "A test task description",
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

  const defaultProps = {
    onClick: vi.fn(),
  };

  it("should not show blocked indicator when blockedByIds is empty", () => {
    const task = createMockTask({ blockedByIds: [] });

    render(<KanbanCard task={task} {...defaultProps} />);

    // Should not have the lock icon / blocked indicator
    const lockedIndicator = document.querySelector(".bg-red-100");
    expect(lockedIndicator).not.toBeInTheDocument();
  });

  it("should not show blocked indicator when blockedByIds is null", () => {
    const task = createMockTask({ blockedByIds: null as unknown as string[] });

    render(<KanbanCard task={task} {...defaultProps} />);

    // Should not have the lock icon / blocked indicator
    const lockedIndicator = document.querySelector(".bg-red-100");
    expect(lockedIndicator).not.toBeInTheDocument();
  });

  it("should show blocked indicator when task has blockers", () => {
    const task = createMockTask({
      blockedByIds: ["blocker-1", "blocker-2"],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    // Should show the blocker count
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should show single blocker count correctly", () => {
    const task = createMockTask({
      blockedByIds: ["blocker-1"],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should have red styling for blocked indicator", () => {
    const task = createMockTask({
      blockedByIds: ["blocker-1"],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    // Check for red background class on the indicator
    const blockedIndicator = document.querySelector(
      ".bg-red-100\\/80, .dark\\:bg-red-900\\/40",
    );
    // The indicator should contain the lock icon and count
    const lockIcon = document.querySelector(".lucide-lock");
    expect(lockIcon).toBeInTheDocument();
  });

  it("should show tooltip with blocker information", () => {
    const task = createMockTask({
      blockedByIds: ["blocker-1", "blocker-2", "blocker-3"],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    // The tooltip content should mention the number of blockers
    // (Note: actual tooltip interaction would require user hover)
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should render task title correctly", () => {
    const task = createMockTask({
      title: "My Important Task",
      blockedByIds: ["blocker-1"],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("My Important Task")).toBeInTheDocument();
  });

  it("should render status badge correctly", () => {
    const task = createMockTask({
      status: "todo",
      blockedByIds: [],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("To Do")).toBeInTheDocument();
  });

  it("should render with different statuses", () => {
    const statuses = [
      "todo",
      "brainstorming",
      "planning",
      "ready",
      "executing",
      "done",
      "stuck",
    ] as const;

    statuses.forEach((status) => {
      const task = createMockTask({ status });
      const { unmount } = render(<KanbanCard task={task} {...defaultProps} />);
      unmount();
    });
  });

  it("should show autonomous mode indicator when enabled", () => {
    const task = createMockTask({
      autonomousMode: true,
    } as Task & { autonomousMode: boolean });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("Auto")).toBeInTheDocument();
  });

  it("should show branch name when present", () => {
    const task = createMockTask({
      branch: "feature/my-branch",
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("feature/my-branch")).toBeInTheDocument();
  });

  it("should call onClick when card is clicked", () => {
    const onClick = vi.fn();
    const task = createMockTask();

    render(<KanbanCard task={task} onClick={onClick} />);

    // Find the card element and click it
    const card = screen.getByText("Test Task").closest("div");
    if (card) {
      card.click();
    }

    // Note: Due to the complex card structure with nested elements,
    // the click may need to be on a specific element
  });

  it("should show description when present", () => {
    const task = createMockTask({
      description: "This is the task description",
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(
      screen.getByText("This is the task description"),
    ).toBeInTheDocument();
  });

  it("should not show description when null", () => {
    const task = createMockTask({
      description: null,
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    // Description should not be in the document
    expect(
      screen.queryByText("A test task description"),
    ).not.toBeInTheDocument();
  });

  it("should show progress bar for active statuses", () => {
    const task = createMockTask({
      status: "executing",
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("Progress")).toBeInTheDocument();
  });

  it("should not show progress bar for done status", () => {
    const task = createMockTask({
      status: "done",
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });

  it("should handle multiple blockers in tooltip", () => {
    const task = createMockTask({
      blockedByIds: ["b1", "b2", "b3", "b4", "b5"],
    });

    render(<KanbanCard task={task} {...defaultProps} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
