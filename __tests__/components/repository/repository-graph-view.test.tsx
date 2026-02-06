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
    prTargetBranch: null,
    prDraft: null,
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
    prTargetBranch: null,
    prDraft: null,
    executionGraph: {
      nodes: [
        {
          id: "step-1",
          type: "sub-task",
          label: "Step 1",
          status: "complete",
          x: 0,
          y: 0,
          width: 120,
          height: 60,
          metadata: {},
        },
        {
          id: "step-2",
          type: "sub-task",
          label: "Step 2",
          status: "in-progress",
          x: 180,
          y: 0,
          width: 120,
          height: 60,
          metadata: {},
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "step-1",
          target: "step-2",
          type: "sequential",
        },
      ],
      metadata: {
        phaseCount: 1,
        agentCount: 0,
        taskId: "task-2",
        lastUpdated: new Date().toISOString(),
      },
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
