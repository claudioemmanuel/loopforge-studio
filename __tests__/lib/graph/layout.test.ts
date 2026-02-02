import { describe, it, expect } from "vitest";
import { calculateGraphLayout, buildDependencyMap } from "@/lib/graph/layout";
import type { Task } from "@/lib/db/schema";

const createMockTask = (
  id: string,
  status: Task["status"],
  blockedByIds: string[] = [],
): Task => ({
  id,
  repoId: "repo-1",
  title: `Task ${id}`,
  description: "",
  status,
  priority: 0,
  autonomousMode: false,
  autoApprove: false,
  blockedByIds,
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
});

describe("buildDependencyMap", () => {
  it("builds correct dependency map", () => {
    const tasks = [
      createMockTask("task-1", "todo", []),
      createMockTask("task-2", "todo", ["task-1"]),
      createMockTask("task-3", "todo", ["task-1", "task-2"]),
    ];

    const map = buildDependencyMap(tasks);

    expect(map["task-1"]).toEqual({
      blockedBy: [],
      blocks: ["task-2", "task-3"],
    });

    expect(map["task-2"]).toEqual({
      blockedBy: ["task-1"],
      blocks: ["task-3"],
    });

    expect(map["task-3"]).toEqual({
      blockedBy: ["task-1", "task-2"],
      blocks: [],
    });
  });

  it("handles tasks with no dependencies", () => {
    const tasks = [
      createMockTask("task-1", "todo", []),
      createMockTask("task-2", "todo", []),
    ];

    const map = buildDependencyMap(tasks);

    expect(map["task-1"]).toEqual({
      blockedBy: [],
      blocks: [],
    });

    expect(map["task-2"]).toEqual({
      blockedBy: [],
      blocks: [],
    });
  });
});

describe("calculateGraphLayout", () => {
  it("positions tasks in correct status columns", () => {
    const tasks = [
      createMockTask("task-1", "todo"),
      createMockTask("task-2", "executing"),
      createMockTask("task-3", "done"),
    ];

    const dependencies = buildDependencyMap(tasks);
    const { nodes } = calculateGraphLayout(
      tasks,
      dependencies,
      new Set(),
      new Map(),
    );

    const task1Node = nodes.find((n) => n.id === "task-1");
    const task2Node = nodes.find((n) => n.id === "task-2");
    const task3Node = nodes.find((n) => n.id === "task-3");

    expect(task1Node).toBeDefined();
    expect(task2Node).toBeDefined();
    expect(task3Node).toBeDefined();

    // Task 1 (todo) should be leftmost
    expect(task1Node!.position.x).toBe(0);

    // Task 2 (executing) should be further right
    expect(task2Node!.position.x).toBeGreaterThan(task1Node!.position.x);

    // Task 3 (done) should be rightmost
    expect(task3Node!.position.x).toBeGreaterThan(task2Node!.position.x);
  });

  it("creates dependency edges", () => {
    const tasks = [
      createMockTask("task-1", "todo", []),
      createMockTask("task-2", "todo", ["task-1"]),
    ];

    const dependencies = buildDependencyMap(tasks);
    const { edges } = calculateGraphLayout(
      tasks,
      dependencies,
      new Set(),
      new Map(),
    );

    const depEdge = edges.find((e) => e.id === "dep-task-1-task-2");

    expect(depEdge).toBeDefined();
    expect(depEdge!.source).toBe("task-1");
    expect(depEdge!.target).toBe("task-2");
  });

  it("expands execution steps when task is expanded", () => {
    const tasks = [
      {
        ...createMockTask("task-1", "executing"),
        executionGraph: {
          nodes: [
            {
              id: "step-1",
              label: "Step 1",
              status: "completed",
              metadata: {},
            },
            { id: "step-2", label: "Step 2", status: "running", metadata: {} },
          ],
          edges: [{ from: "step-1", to: "step-2" }],
        },
      },
    ];

    const dependencies = buildDependencyMap(tasks);
    const executions = new Map();
    executions.set("task-1", tasks[0].executionGraph);

    const { nodes, edges } = calculateGraphLayout(
      tasks,
      dependencies,
      new Set(["task-1"]),
      executions,
    );

    // Should have task node + 2 execution step nodes
    expect(nodes.length).toBe(3);

    const stepNodes = nodes.filter((n) => n.type === "executionStep");
    expect(stepNodes.length).toBe(2);

    // Should have execution step edge
    const stepEdge = edges.find((e) =>
      e.id.includes("task-1-edge-step-1-step-2"),
    );
    expect(stepEdge).toBeDefined();
  });

  it("does not expand execution steps when task is not expanded", () => {
    const tasks = [
      {
        ...createMockTask("task-1", "executing"),
        executionGraph: {
          nodes: [
            {
              id: "step-1",
              label: "Step 1",
              status: "completed",
              metadata: {},
            },
          ],
          edges: [],
        },
      },
    ];

    const dependencies = buildDependencyMap(tasks);
    const executions = new Map();
    executions.set("task-1", tasks[0].executionGraph);

    const { nodes } = calculateGraphLayout(
      tasks,
      dependencies,
      new Set(), // Not expanded
      executions,
    );

    // Should only have task node
    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe("task");
  });
});
