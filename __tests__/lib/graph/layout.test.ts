import { describe, expect, it } from "vitest";
import {
  buildDependencyMap,
  calculateGraphLayout,
} from "@/lib/shared/graph-layout";
import type { Task } from "@/lib/db/schema";
import type { ExecutionGraph } from "@/lib/shared/graph-types";

function makeTask(
  id: string,
  status: Task["status"],
  blockedByIds: string[] = [],
) {
  return {
    id,
    repoId: "repo-1",
    title: `Task ${id}`,
    description: null,
    status,
    priority: 0,
    blockedByIds,
  } as Task;
}

function makeExecutionGraph(): ExecutionGraph {
  return {
    metadata: {
      phaseCount: 1,
      agentCount: 0,
      taskId: "a",
      lastUpdated: new Date().toISOString(),
    },
    nodes: [
      {
        id: "s1",
        type: "sub-task",
        label: "Step 1",
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        status: "complete",
        metadata: {},
      },
      {
        id: "s2",
        type: "sub-task",
        label: "Step 2",
        x: 120,
        y: 0,
        width: 100,
        height: 40,
        status: "in-progress",
        metadata: {},
      },
    ],
    edges: [{ id: "e1", source: "s1", target: "s2", type: "sequential" }],
  };
}

describe("graph-layout", () => {
  it("builds dependency maps with reverse links", () => {
    const tasks = [
      makeTask("a", "todo"),
      makeTask("b", "ready", ["a"]),
      makeTask("c", "ready", ["a"]),
    ];

    const map = buildDependencyMap(tasks);
    expect(map.b.blockedBy).toEqual(["a"]);
    expect(map.a.blocks.sort()).toEqual(["b", "c"]);
  });

  it("calculates node/edge layout for tasks and expanded execution steps", () => {
    const tasks = [makeTask("a", "executing"), makeTask("b", "ready", ["a"])];
    const deps = buildDependencyMap(tasks);
    const expanded = new Set<string>(["a"]);
    const executions = new Map<string, ExecutionGraph>([
      ["a", makeExecutionGraph()],
    ]);

    const result = calculateGraphLayout(tasks, deps, expanded, executions);

    expect(result.nodes.some((node) => node.id === "a")).toBe(true);
    expect(result.nodes.some((node) => node.id.startsWith("a-step-"))).toBe(
      true,
    );
    expect(result.edges.some((edge) => edge.id === "dep-a-b")).toBe(true);
  });
});
