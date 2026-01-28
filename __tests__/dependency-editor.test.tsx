/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task, TaskDependency } from "@/lib/db/schema";

// Mock the useTaskDependencies hook
const mockAddDependency = vi.fn();
const mockRemoveDependency = vi.fn();
const mockSetAutoExecuteWhenUnblocked = vi.fn();

vi.mock("@/components/hooks/use-task-dependencies", () => ({
  useTaskDependencies: vi.fn(() => ({
    blockedBy: [],
    blocks: [],
    availableTasks: [],
    autoExecuteWhenUnblocked: false,
    dependencyPriority: 0,
    isLoading: false,
    error: null,
    addDependency: mockAddDependency,
    removeDependency: mockRemoveDependency,
    setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
    setDependencyPriority: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    ...props
  }: React.PropsWithChildren<{ disabled?: boolean }>) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => <>{children}</>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

// Import the mock and component after setting up mocks
import { useTaskDependencies } from "@/components/hooks/use-task-dependencies";
import { DependencyEditor } from "@/components/dependency-editor";

describe("DependencyEditor Component", () => {
  const defaultProps = {
    taskId: "task-123",
    repoId: "repo-456",
  };

  const mockBlocker: Task = {
    id: "blocker-1",
    repoId: "repo-456",
    title: "Blocker Task",
    description: "A task that blocks others",
    status: "executing",
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
  };

  const mockBlockedTask: Task = {
    ...mockBlocker,
    id: "blocked-1",
    title: "Blocked Task",
    status: "todo",
  };

  const mockDependency: TaskDependency = {
    id: "dep-1",
    taskId: "task-123",
    blockedById: "blocker-1",
    createdAt: new Date(),
  };

  const mockAvailableTask: Task = {
    ...mockBlocker,
    id: "available-1",
    title: "Available Task",
    status: "todo",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default state
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });
  });

  it("should render loading state", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: true,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    expect(screen.getByText(/loading dependencies/i)).toBeInTheDocument();
  });

  it("should render error state", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: new Error("Failed to load"),
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    expect(
      screen.getByText(/failed to load dependencies/i),
    ).toBeInTheDocument();
  });

  it("should render empty blockers message", () => {
    render(<DependencyEditor {...defaultProps} />);

    expect(screen.getByText(/no blockers/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this task can proceed independently/i),
    ).toBeInTheDocument();
  });

  it("should render empty blocks message", () => {
    render(<DependencyEditor {...defaultProps} />);

    expect(
      screen.getByText(/no tasks are waiting on this one/i),
    ).toBeInTheDocument();
  });

  it("should display blocker tasks", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [{ dependency: mockDependency, task: mockBlocker }],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    expect(screen.getByText("Blocker Task")).toBeInTheDocument();
    expect(screen.getByText("executing")).toBeInTheDocument();
  });

  it("should display tasks that this task blocks", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [],
      blocks: [
        {
          dependency: { ...mockDependency, id: "dep-2" },
          task: mockBlockedTask,
        },
      ],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    expect(screen.getByText("Blocked Task")).toBeInTheDocument();
  });

  it("should display blocker count badge", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [
        { dependency: mockDependency, task: mockBlocker },
        {
          dependency: { ...mockDependency, id: "dep-2" },
          task: { ...mockBlocker, id: "blocker-2", title: "Blocker 2" },
        },
      ],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    // Should show count badge
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should call removeDependency when remove button clicked", async () => {
    mockRemoveDependency.mockResolvedValue(true);

    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [{ dependency: mockDependency, task: mockBlocker }],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    // Find and click the remove button (X icon)
    const removeButtons = screen.getAllByRole("button");
    const removeButton = removeButtons.find((btn) =>
      btn.querySelector("svg.lucide-x"),
    );

    if (removeButton) {
      await userEvent.click(removeButton);
    }

    await waitFor(() => {
      expect(mockRemoveDependency).toHaveBeenCalledWith("blocker-1");
    });
  });

  it("should toggle auto-execute setting", async () => {
    mockSetAutoExecuteWhenUnblocked.mockResolvedValue(true);

    render(<DependencyEditor {...defaultProps} />);

    // Find the toggle button
    const toggleButton = screen.getByRole("button", { name: "" });

    // The toggle should be in the component
    expect(
      screen.getByText(/auto-execute when unblocked/i),
    ).toBeInTheDocument();

    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockSetAutoExecuteWhenUnblocked).toHaveBeenCalledWith(true);
    });
  });

  it("should show Add button as disabled when no available tasks", () => {
    render(<DependencyEditor {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add/i });
    expect(addButton).toBeDisabled();
  });

  it("should enable Add button when tasks are available", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [],
      blocks: [],
      availableTasks: [mockAvailableTask],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add/i });
    expect(addButton).not.toBeDisabled();
  });

  it("should call hook with correct taskId and repoId", () => {
    render(<DependencyEditor taskId="my-task" repoId="my-repo" />);

    expect(useTaskDependencies).toHaveBeenCalledWith({
      taskId: "my-task",
      repoId: "my-repo",
    });
  });

  it("should show auto-execute toggle in correct state", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: true,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    // When auto-execute is enabled, the Zap icon should have amber color
    const zapIcon = document.querySelector(".text-amber-500");
    expect(zapIcon).toBeInTheDocument();
  });

  it("should display status colors for different task statuses", () => {
    vi.mocked(useTaskDependencies).mockReturnValue({
      blockedBy: [
        {
          dependency: mockDependency,
          task: { ...mockBlocker, status: "done" },
        },
        {
          dependency: { ...mockDependency, id: "dep-2" },
          task: {
            ...mockBlocker,
            id: "blocker-2",
            title: "Blocker 2",
            status: "stuck",
          },
        },
      ],
      blocks: [],
      availableTasks: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      isLoading: false,
      error: null,
      addDependency: mockAddDependency,
      removeDependency: mockRemoveDependency,
      setAutoExecuteWhenUnblocked: mockSetAutoExecuteWhenUnblocked,
      setDependencyPriority: vi.fn(),
      refresh: vi.fn(),
    });

    render(<DependencyEditor {...defaultProps} />);

    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("stuck")).toBeInTheDocument();
  });
});
