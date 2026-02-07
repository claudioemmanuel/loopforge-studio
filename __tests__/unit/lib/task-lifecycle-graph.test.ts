import { describe, expect, it } from "vitest";
import { buildTaskLifecycleGraph } from "@/lib/shared/task-lifecycle-graph";
import type { Task, StatusHistoryEntry } from "@/lib/db/schema";

function makeTask(
  id: string,
  status: Task["status"],
  statusHistory: StatusHistoryEntry[] = [],
  blockedByIds: string[] = [],
): Task {
  return {
    id,
    repoId: "repo-1",
    title: `Task ${id}`,
    description: "Task description",
    status,
    priority: 0,
    blockedByIds,
    statusHistory,
    createdAt: new Date("2026-02-07T10:00:00.000Z"),
    updatedAt: new Date("2026-02-07T12:00:00.000Z"),
  } as Task;
}

describe("buildTaskLifecycleGraph", () => {
  it("builds timeline nodes from creation through current status", () => {
    const tasks = [
      makeTask("task-1", "executing", [
        {
          from: "todo",
          to: "brainstorming",
          timestamp: "2026-02-07T10:10:00.000Z",
          triggeredBy: "worker",
        },
        {
          from: "brainstorming",
          to: "planning",
          timestamp: "2026-02-07T10:20:00.000Z",
          triggeredBy: "autonomous",
        },
      ]),
    ];

    const graph = buildTaskLifecycleGraph(tasks);
    const taskNodes = graph.nodes.filter((node) => node.taskId === "task-1");

    expect(taskNodes.length).toBeGreaterThanOrEqual(3);
    expect(taskNodes.some((node) => node.kind === "created")).toBe(true);
    expect(taskNodes.some((node) => node.toStatus === "planning")).toBe(true);
    expect(taskNodes.some((node) => node.toStatus === "executing")).toBe(true);
    expect(graph.edges.some((edge) => edge.type === "timeline")).toBe(true);
  });

  it("links dependency edges between task lifecycle chains", () => {
    const tasks = [
      makeTask("task-a", "done"),
      makeTask("task-b", "todo", [], ["task-a"]),
    ];

    const graph = buildTaskLifecycleGraph(tasks);

    expect(
      graph.edges.some(
        (edge) => edge.type === "dependency" && edge.sourceTaskId === "task-a",
      ),
    ).toBe(true);
  });
});
