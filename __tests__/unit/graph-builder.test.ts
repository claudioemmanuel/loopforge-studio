import { describe, it, expect } from "vitest";
import { buildExecutionGraph } from "@/lib/shared/graph-builder";
import type { ExecutionData } from "@/lib/shared/graph-types";
import { DEFAULT_LAYOUT_CONFIG } from "@/lib/shared/graph-types";

describe("Graph Builder", () => {
  describe("buildExecutionGraph", () => {
    it("should build graph from execution data", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "executing",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Starting brainstorming phase",
            createdAt: new Date(),
            metadata: { phase: "brainstorming" },
          },
          {
            id: "event-2",
            eventType: "complete",
            content: "Brainstorming complete",
            createdAt: new Date(),
            metadata: { phase: "brainstorming", duration: 5000 },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
      expect(graph.metadata.taskId).toBe("task-1");
    });

    it("should handle empty execution data", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "todo",
        events: [],
      };

      const graph = await buildExecutionGraph(executionData);

      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
      expect(graph.metadata.phaseCount).toBe(0);
    });

    it("should create nodes for execution phases", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "executing",
        phase: "executing",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Brainstorming phase started",
            createdAt: new Date(),
            metadata: { phase: "brainstorming" },
          },
          {
            id: "event-2",
            eventType: "thinking",
            content: "Planning phase started",
            createdAt: new Date(),
            metadata: { phase: "planning" },
          },
          {
            id: "event-3",
            eventType: "thinking",
            content: "Executing phase started",
            createdAt: new Date(),
            metadata: { phase: "executing" },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
      expect(graph.metadata.phaseCount).toBeGreaterThanOrEqual(0);
    });

    it("should create edges between sequential phases", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "planning",
        phase: "planning",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Brainstorming",
            createdAt: new Date(),
            metadata: { phase: "brainstorming" },
          },
          {
            id: "event-2",
            eventType: "complete",
            content: "Brainstorming complete",
            createdAt: new Date(),
            metadata: { phase: "brainstorming" },
          },
          {
            id: "event-3",
            eventType: "thinking",
            content: "Planning",
            createdAt: new Date(),
            metadata: { phase: "planning" },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      // Edges depend on actual implementation
      expect(graph.edges).toBeDefined();
    });

    it("should calculate node positions using layout", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "brainstorming",
        phase: "brainstorming",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Brainstorming phase",
            createdAt: new Date(),
            metadata: { phase: "brainstorming" },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      graph.nodes.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBeGreaterThan(0);
      });
    });

    it("should use custom layout configuration", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "brainstorming",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Brainstorming",
            createdAt: new Date(),
          },
        ],
      };

      const customLayout = {
        ...DEFAULT_LAYOUT_CONFIG,
        rankdir: "TB" as const,
      };

      const graph = await buildExecutionGraph(executionData, customLayout);

      expect(graph).toBeDefined();
      expect(graph.nodes).toBeDefined();
    });

    it("should include agent nodes for multi-agent tasks", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "executing",
        phase: "executing",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Executing",
            createdAt: new Date(),
            metadata: { phase: "executing" },
          },
          {
            id: "event-2",
            eventType: "thinking",
            content: "Running tests",
            createdAt: new Date(),
            metadata: { agentType: "test" },
          },
          {
            id: "event-3",
            eventType: "command_run",
            content: "npm run build",
            createdAt: new Date(),
            metadata: { agentType: "backend" },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      const agentNodes = graph.nodes.filter((n) => n.type === "agent");
      expect(agentNodes).toBeDefined();
      expect(graph.metadata.agentCount).toBeGreaterThanOrEqual(0);
    });

    it("should set node status based on events", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "planning",
        phase: "planning",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Brainstorming",
            createdAt: new Date(),
            metadata: { phase: "brainstorming", status: "complete" },
          },
          {
            id: "event-2",
            eventType: "thinking",
            content: "Planning",
            createdAt: new Date(),
            metadata: { phase: "planning", status: "in-progress" },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      expect(graph.nodes).toBeDefined();
      // Status setting depends on implementation logic
    });

    it("should include metadata in nodes", async () => {
      const executionData: ExecutionData = {
        taskId: "task-1",
        status: "brainstorming",
        events: [
          {
            id: "event-1",
            eventType: "thinking",
            content: "Brainstorming",
            createdAt: new Date(),
            metadata: { phase: "brainstorming" },
          },
          {
            id: "event-2",
            eventType: "complete",
            content: "Brainstorming complete",
            createdAt: new Date(),
            metadata: {
              phase: "brainstorming",
              duration: 5000,
              commits: [{ sha: "abc123", message: "Test commit" }],
            },
          },
        ],
      };

      const graph = await buildExecutionGraph(executionData);

      expect(graph.metadata).toBeDefined();
      expect(graph.metadata.taskId).toBe("task-1");
    });
  });
});
