import { describe, it, expect } from "vitest";
import {
  NODE_SIZES,
  ZOOM_CONFIG,
  DEFAULT_LAYOUT_CONFIG,
  ANIMATION_DURATIONS,
} from "@/lib/execution/graph-types";
import type {
  ExecutionGraph,
  GraphNode,
  GraphEdge,
} from "@/lib/execution/graph-types";

describe("Execution Graph Types", () => {
  it("should have correct node sizes", () => {
    expect(NODE_SIZES.phase.width).toBe(240);
    expect(NODE_SIZES.phase.height).toBe(120);
    expect(NODE_SIZES["sub-task"].width).toBe(180);
    expect(NODE_SIZES.agent.width).toBe(160);
  });

  it("should have correct zoom configuration", () => {
    expect(ZOOM_CONFIG.min).toBe(0.25);
    expect(ZOOM_CONFIG.max).toBe(2.0);
    expect(ZOOM_CONFIG.default).toBe(1.0);
  });

  it("should have correct layout configuration", () => {
    expect(DEFAULT_LAYOUT_CONFIG.rankdir).toBe("LR");
    expect(DEFAULT_LAYOUT_CONFIG.ranksep).toBe(100);
    expect(DEFAULT_LAYOUT_CONFIG.nodesep).toBe(50);
  });

  it("should have correct animation durations", () => {
    expect(ANIMATION_DURATIONS.statusTransition).toBe(300);
    expect(ANIMATION_DURATIONS.flowAnimation).toBe(2000);
    expect(ANIMATION_DURATIONS.pulseEffect).toBe(500);
  });

  it("should create valid graph structure", () => {
    const graph: ExecutionGraph = {
      nodes: [
        {
          id: "node-1",
          type: "phase",
          label: "Planning",
          status: "complete",
          x: 100,
          y: 100,
          width: 240,
          height: 120,
          metadata: {},
        },
      ],
      edges: [],
      metadata: {
        phaseCount: 1,
        agentCount: 0,
        taskId: "test-task",
        lastUpdated: new Date().toISOString(),
      },
    };

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe("phase");
    expect(graph.metadata.phaseCount).toBe(1);
  });

  it("should create valid edge connections", () => {
    const edge: GraphEdge = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      type: "sequential",
      animated: false,
    };

    expect(edge.source).toBe("node-1");
    expect(edge.target).toBe("node-2");
    expect(edge.type).toBe("sequential");
  });
});

describe("Graph Node Types", () => {
  it("should support all node types", () => {
    const types: Array<GraphNode["type"]> = ["phase", "sub-task", "agent"];

    types.forEach((type) => {
      const node: GraphNode = {
        id: `node-${type}`,
        type,
        label: `Test ${type}`,
        status: "pending",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        metadata: {},
      };

      expect(node.type).toBe(type);
    });
  });

  it("should support all node statuses", () => {
    const statuses: Array<GraphNode["status"]> = [
      "pending",
      "in-progress",
      "complete",
      "failed",
      "stuck",
    ];

    statuses.forEach((status) => {
      const node: GraphNode = {
        id: `node-${status}`,
        type: "phase",
        label: `Test ${status}`,
        status,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        metadata: {},
      };

      expect(node.status).toBe(status);
    });
  });

  it("should support metadata fields", () => {
    const node: GraphNode = {
      id: "node-1",
      type: "phase",
      label: "Test",
      status: "complete",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      metadata: {
        duration: 5000,
        progress: 100,
        agentType: "test",
        commits: [{ sha: "abc123", message: "Test commit" }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    };

    expect(node.metadata.duration).toBe(5000);
    expect(node.metadata.agentType).toBe("test");
    expect(node.metadata.commits).toHaveLength(1);
  });
});

describe("Graph Edge Types", () => {
  it("should support all edge types", () => {
    const types: Array<GraphEdge["type"]> = [
      "sequential",
      "parallel",
      "dependency",
    ];

    types.forEach((type) => {
      const edge: GraphEdge = {
        id: `edge-${type}`,
        source: "node-1",
        target: "node-2",
        type,
      };

      expect(edge.type).toBe(type);
    });
  });

  it("should support animated edges", () => {
    const edge: GraphEdge = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      type: "sequential",
      animated: true,
    };

    expect(edge.animated).toBe(true);
  });

  it("should support edge labels", () => {
    const edge: GraphEdge = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      type: "dependency",
      label: "blocks",
    };

    expect(edge.label).toBe("blocks");
  });
});
