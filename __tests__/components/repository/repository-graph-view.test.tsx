/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RepositoryGraphView } from "@/components/repository/repository-graph-view";
import type { Task } from "@/lib/db/schema";

// Mock fetch
global.fetch = vi.fn();

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Controls: () => <div data-testid="flow-controls" />,
  Background: () => <div data-testid="flow-background" />,
  MiniMap: () => <div data-testid="flow-minimap" />,
}));

const mockTasks: Task[] = [
  {
    id: "task-1",
    repoId: "repo-1",
    title: "First Task",
    description: "Description for first task",
    status: "todo",
    priority: 0,
    autonomousMode: false,
    autoApprove: false,
    blockedByIds: [],
    autoExecuteWhenUnblocked: false,
    dependencyPriority: 0,
    brainstormResult: null,
    brainstormConversation: null,
    brainstormSummary: null,
    brainstormMessageCount: 0,
    brainstormCompactedAt: null,
    planContent: null,
    branch: null,
    processingPhase: null,
    processingJobId: null,
    processingStartedAt: null,
    processingStatusText: null,
    processingProgress: 0,
    statusHistory: [],
    prUrl: null,
    prNumber: null,
    executionGraph: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "task-2",
    repoId: "repo-1",
    title: "Second Task",
    description: "Description for second task",
    status: "executing",
    priority: 1,
    autonomousMode: false,
    autoApprove: false,
    blockedByIds: ["task-1"],
    autoExecuteWhenUnblocked: false,
    dependencyPriority: 0,
    brainstormResult: null,
    brainstormConversation: null,
    brainstormSummary: null,
    brainstormMessageCount: 0,
    brainstormCompactedAt: null,
    planContent: null,
    branch: "feature/task-2",
    processingPhase: "executing",
    processingJobId: null,
    processingStartedAt: null,
    processingStatusText: null,
    processingProgress: 50,
    statusHistory: [],
    prUrl: null,
    prNumber: null,
    executionGraph: {
      nodes: [
        { id: "step-1", label: "Step 1", status: "completed", metadata: {} },
        { id: "step-2", label: "Step 2", status: "running", metadata: {} },
      ],
      edges: [{ from: "step-1", to: "step-2" }],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("RepositoryGraphView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<RepositoryGraphView repositoryId="repo-1" />);

    expect(screen.getByText("Loading graph...")).toBeInTheDocument();
  });

  it("fetches and displays graph data", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tasks: mockTasks,
        dependencies: {
          "task-1": { blockedBy: [], blocks: ["task-2"] },
          "task-2": { blockedBy: ["task-1"], blocks: [] },
        },
        executions: {
          "task-2": mockTasks[1].executionGraph,
        },
      }),
    });

    render(<RepositoryGraphView repositoryId="repo-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/repos/repo-1/graph");
  });

  it("displays empty state when no tasks", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tasks: [],
        dependencies: {},
        executions: {},
      }),
    });

    render(<RepositoryGraphView repositoryId="repo-1" />);

    await waitFor(() => {
      expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Create your first task to see it visualized here"),
    ).toBeInTheDocument();
  });

  it("displays error state on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    });

    render(<RepositoryGraphView repositoryId="repo-1" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load graph")).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to fetch graph data")).toBeInTheDocument();
  });

  it("displays error state on network error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    render(<RepositoryGraphView repositoryId="repo-1" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load graph")).toBeInTheDocument();
    });

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });
});
