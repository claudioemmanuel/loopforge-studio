import { describe, expect, it } from "vitest";
import type { PlanStep } from "@/lib/agents/types";
import {
  buildDependencyGraph,
  getProgress,
  getReadyTasks,
  markTaskCompleted,
  markTaskRunning,
  validateGraph,
} from "@/lib/ralph/dependency-graph";

describe("ralph dependency graph", () => {
  const steps: PlanStep[] = [
    { id: "a", title: "A", description: "", dependencies: [] },
    { id: "b", title: "B", description: "", dependencies: ["a"] },
  ];

  it("builds and validates acyclic graph", () => {
    const graph = buildDependencyGraph(steps);
    const validation = validateGraph(graph);
    expect(validation.valid).toBe(true);
    expect(graph.roots).toEqual(["a"]);
  });

  it("returns ready tasks based on dependency status", () => {
    const graph = buildDependencyGraph(steps);
    let ready = getReadyTasks(graph);
    expect(ready.map((task) => task.id)).toEqual(["a"]);

    markTaskRunning(graph, "a");
    markTaskCompleted(graph, "a");
    ready = getReadyTasks(graph);
    expect(ready.map((task) => task.id)).toEqual(["b"]);
  });

  it("tracks progress counters", () => {
    const graph = buildDependencyGraph(steps);
    markTaskRunning(graph, "a");
    markTaskCompleted(graph, "a");
    const progress = getProgress(graph);
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1);
    expect(progress.pending).toBe(1);
  });
});
