/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGraphLayout } from "@/components/execution/use-graph-layout";
import type { ExecutionGraph } from "@/lib/execution/graph-types";
import { DEFAULT_LAYOUT_CONFIG } from "@/lib/execution/graph-types";

describe("useGraphLayout", () => {
  describe("Layout Calculation", () => {
    it("should calculate layout for simple graph", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Planning",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
          {
            id: "node-2",
            type: "phase",
            label: "Executing",
            status: "in-progress",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            type: "sequential",
          },
        ],
        metadata: {
          taskId: "task-1",
          phaseCount: 2,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      expect(result.current).toBeTruthy();
      expect(result.current?.nodes).toHaveLength(2);
      expect(result.current?.edges).toHaveLength(1);
    });

    it("should position nodes correctly", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [],
        metadata: {
          taskId: "task-1",
          phaseCount: 1,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      const node = result.current?.nodes[0];
      expect(node?.x).toBeGreaterThanOrEqual(0);
      expect(node?.y).toBeGreaterThanOrEqual(0);
    });

    it("should calculate graph dimensions", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
          {
            id: "node-2",
            type: "phase",
            label: "Node 2",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            type: "sequential",
          },
        ],
        metadata: {
          taskId: "task-1",
          phaseCount: 2,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      expect(result.current?.width).toBeGreaterThan(0);
      expect(result.current?.height).toBeGreaterThan(0);
    });

    it("should handle empty graph", () => {
      const graph: ExecutionGraph = {
        nodes: [],
        edges: [],
        metadata: {
          taskId: "task-1",
          phaseCount: 0,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      // Empty graphs return null (no layout to compute)
      expect(result.current).toBeNull();
    });
  });

  describe("Custom Layout Configuration", () => {
    it("should use custom layout config", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [],
        metadata: {
          taskId: "task-1",
          phaseCount: 1,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const customConfig = {
        ...DEFAULT_LAYOUT_CONFIG,
        ranksep: 200,
      };

      const { result } = renderHook(() =>
        useGraphLayout(graph, { layoutConfig: customConfig }),
      );

      expect(result.current).toBeTruthy();
    });
  });

  describe("Edge Animations", () => {
    it("should mark in-progress edges as animated", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
          {
            id: "node-2",
            type: "phase",
            label: "Node 2",
            status: "in-progress",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            type: "sequential",
          },
        ],
        metadata: {
          taskId: "task-1",
          phaseCount: 2,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      const edge = result.current?.edges[0];
      expect(edge?.animated).toBe(true);
    });

    it("should not animate completed edges", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
          {
            id: "node-2",
            type: "phase",
            label: "Node 2",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            type: "sequential",
          },
        ],
        metadata: {
          taskId: "task-1",
          phaseCount: 2,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      const edge = result.current?.edges[0];
      expect(edge?.animated).toBe(false);
    });
  });

  describe("Parallel Edges", () => {
    it("should handle parallel edges with offsets", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
          {
            id: "node-2",
            type: "agent",
            label: "Agent 1",
            status: "in-progress",
            x: 0,
            y: 0,
            width: 160,
            height: 60,
            metadata: {},
          },
          {
            id: "node-3",
            type: "agent",
            label: "Agent 2",
            status: "in-progress",
            x: 0,
            y: 0,
            width: 160,
            height: 60,
            metadata: {},
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            type: "parallel",
          },
          {
            id: "edge-2",
            source: "node-1",
            target: "node-3",
            type: "parallel",
          },
        ],
        metadata: {
          taskId: "task-1",
          phaseCount: 1,
          agentCount: 2,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result } = renderHook(() => useGraphLayout(graph));

      expect(result.current?.edges).toHaveLength(2);
      // Parallel edges should exist
    });
  });

  describe("Memoization", () => {
    it("should memoize layout calculation", () => {
      const graph: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [],
        metadata: {
          taskId: "task-1",
          phaseCount: 1,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result, rerender } = renderHook(() => useGraphLayout(graph));

      const firstResult = result.current;

      // Rerender with same graph
      rerender();

      const secondResult = result.current;

      // Memoization should produce consistent results
      expect(secondResult).toStrictEqual(firstResult);
    });

    it("should recalculate when graph changes", () => {
      const graph1: ExecutionGraph = {
        nodes: [
          {
            id: "node-1",
            type: "phase",
            label: "Node 1",
            status: "complete",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
        edges: [],
        metadata: {
          taskId: "task-1",
          phaseCount: 1,
          agentCount: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      const { result, rerender } = renderHook(
        ({ graph }) => useGraphLayout(graph),
        {
          initialProps: { graph: graph1 },
        },
      );

      const firstNodeCount = result.current?.nodes.length || 0;

      // Update graph
      const graph2: ExecutionGraph = {
        ...graph1,
        nodes: [
          ...graph1.nodes,
          {
            id: "node-2",
            type: "phase",
            label: "Node 2",
            status: "pending",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            metadata: {},
          },
        ],
      };

      rerender({ graph: graph2 });

      const secondNodeCount = result.current?.nodes.length || 0;

      // Should recalculate with new nodes
      expect(secondNodeCount).toBeGreaterThan(firstNodeCount);
      expect(result.current?.nodes).toHaveLength(2);
    });
  });
});
