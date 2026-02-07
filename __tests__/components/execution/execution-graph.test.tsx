/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExecutionGraph } from "@/components/execution/execution-graph";
import type { ExecutionGraph as ExecutionGraphType } from "@/lib/shared/graph-types";

const mockUseGraphLayout = vi.fn();
const mockUseGraphRealtime = vi.fn();
const mockUseGraphKeyboard = vi.fn();

vi.mock("@/components/execution/use-graph-layout", () => ({
  useGraphLayout: (...args: unknown[]) => mockUseGraphLayout(...args),
}));

vi.mock("@/components/execution/use-graph-realtime", () => ({
  useGraphRealtime: (...args: unknown[]) => mockUseGraphRealtime(...args),
}));

vi.mock("@/components/execution/use-graph-keyboard", () => ({
  useGraphKeyboard: (...args: unknown[]) => mockUseGraphKeyboard(...args),
}));

vi.mock("@/components/execution/graph-accessibility", () => ({
  GraphAnnouncer: class {
    announceConnectionStatus() {}
    destroy() {}
  },
  prefersReducedMotion: () => false,
}));

vi.mock("@xyflow/react", async () => {
  const ReactModule = await import("react");

  return {
    ReactFlow: ({
      children,
      nodes,
      onNodeClick,
      onNodeMouseEnter,
      onInit,
    }: {
      children?: React.ReactNode;
      nodes?: Array<{
        id: string;
        data: { graphNode: unknown };
      }>;
      onNodeClick?: (
        event: React.MouseEvent<HTMLButtonElement>,
        node: unknown,
      ) => void;
      onNodeMouseEnter?: (
        event: React.MouseEvent<HTMLButtonElement>,
        node: unknown,
      ) => void;
      onInit?: (instance: {
        fitView: () => void;
        zoomIn: () => void;
        zoomOut: () => void;
        setViewport: () => void;
      }) => void;
    }) => {
      const hasInitialized = ReactModule.useRef(false);

      ReactModule.useEffect(() => {
        if (hasInitialized.current) {
          return;
        }
        hasInitialized.current = true;
        onInit?.({
          fitView: vi.fn(),
          zoomIn: vi.fn(),
          zoomOut: vi.fn(),
          setViewport: vi.fn(),
        });
      }, [onInit]);

      return (
        <div data-testid="react-flow">
          {nodes?.map((node) => (
            <button
              key={node.id}
              type="button"
              data-testid={`flow-node-${node.id}`}
              onClick={(event) => onNodeClick?.(event, node)}
              onMouseEnter={(event) => onNodeMouseEnter?.(event, node)}
            >
              {node.id}
            </button>
          ))}
          {children}
        </div>
      );
    },
    Background: () => <div data-testid="flow-background" />,
    MiniMap: () => <div data-testid="flow-minimap" />,
    BackgroundVariant: {
      Dots: "dots",
    },
  };
});

const sampleGraph: ExecutionGraphType = {
  nodes: [
    {
      id: "phase-1",
      type: "phase",
      label: "Planning",
      status: "in-progress",
      x: 200,
      y: 120,
      width: 240,
      height: 120,
      metadata: {
        progress: 40,
      },
    },
  ],
  edges: [],
  metadata: {
    phaseCount: 1,
    agentCount: 0,
    taskId: "task-1",
    lastUpdated: new Date().toISOString(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();

  mockUseGraphRealtime.mockReturnValue({
    isConnected: true,
    updatedNodeIds: new Set<string>(),
  });

  mockUseGraphKeyboard.mockReturnValue({
    focusedNodeIndex: 0,
  });
});

describe("ExecutionGraph", () => {
  it("renders loading state when layout is unavailable", () => {
    mockUseGraphLayout.mockReturnValue(null);

    render(<ExecutionGraph taskId="task-1" executionGraph={sampleGraph} />);

    expect(screen.getByText("Computing graph layout...")).toBeInTheDocument();
  });

  it("renders React Flow graph and overlays when layout is available", () => {
    mockUseGraphLayout.mockReturnValue({
      nodes: sampleGraph.nodes,
      edges: sampleGraph.edges,
      width: 400,
      height: 220,
    });

    render(
      <ExecutionGraph
        taskId="task-1"
        executionGraph={sampleGraph}
        enableRealtime
      />,
    );

    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    expect(screen.getByTestId("flow-background")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Legend")).toBeInTheDocument();
  });

  it("forwards node selection through onNodeClick callback", () => {
    mockUseGraphLayout.mockReturnValue({
      nodes: sampleGraph.nodes,
      edges: sampleGraph.edges,
      width: 400,
      height: 220,
    });

    const onNodeClick = vi.fn();

    render(
      <ExecutionGraph
        taskId="task-1"
        executionGraph={sampleGraph}
        onNodeClick={onNodeClick}
      />,
    );

    fireEvent.click(screen.getByTestId("flow-node-phase-1"));

    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(onNodeClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "phase-1",
        label: "Planning",
      }),
    );
  });
});
