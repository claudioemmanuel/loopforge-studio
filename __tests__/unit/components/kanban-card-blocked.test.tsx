/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Task } from "@/lib/db/schema";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

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
  CSS: { Transform: { toString: () => "" } },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 hours ago",
}));

vi.mock("@/components/kanban/dependency-highlight-context", () => ({
  useDependencyHighlight: () => ({
    hoveredTaskId: null,
    blockerIds: [],
    blockedByIds: [],
    dependencyChainIds: [],
    hasConnections: false,
    setHoveredTask: vi.fn(),
    isBlocker: () => false,
    isBlocked: () => false,
    isUnrelated: () => false,
    isInChain: () => false,
  }),
}));

vi.mock("@/components/kanban/kanban-focus-context", () => ({
  useKanbanFocus: () => ({
    focusedTaskId: null,
    registerCard: vi.fn(),
    unregisterCard: vi.fn(),
  }),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}));

import { KanbanCard } from "@/components/kanban/kanban-card";

const createTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: "task-1",
    repoId: "repo-1",
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

describe("KanbanCard blocked badge", () => {
  it("shows blocker count when task has blockers", () => {
    render(
      <KanbanCard
        task={createTask({ blockedByIds: ["a", "b"] })}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show blocker count when task has no blockers", () => {
    render(
      <KanbanCard task={createTask({ blockedByIds: [] })} onClick={vi.fn()} />,
    );
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("renders branch and autonomous indicators", () => {
    render(
      <KanbanCard
        task={createTask({ autonomousMode: true, branch: "feature/ddd" })}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("feature/ddd")).toBeInTheDocument();
  });
});
