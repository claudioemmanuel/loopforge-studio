import { describe, expect, it } from "vitest";
import { analyzeTask, routeTaskToAgent, routeTasks } from "@/lib/agents/router";
import type { PlanStep } from "@/lib/agents/types";

describe("agent-routing", () => {
  it("routes backend-flavored tasks to a concrete agent", () => {
    const task: PlanStep = {
      id: "1",
      title: "Design REST API endpoint for user CRUD",
      description: "Create backend service and persistence logic",
      dependencies: [],
      tags: ["backend", "api"],
    };

    const result = routeTaskToAgent(task);
    expect(result.agent.id).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("routes multiple tasks and preserves mapping by task id", () => {
    const tasks: PlanStep[] = [
      {
        id: "a",
        title: "Refactor React UI",
        description: "",
        dependencies: [],
      },
      {
        id: "b",
        title: "Optimize SQL query performance",
        description: "",
        dependencies: [],
      },
    ];

    const routed = routeTasks(tasks);
    expect(routed.get("a")?.agent.id).toBeTruthy();
    expect(routed.get("b")?.agent.id).toBeTruthy();
  });

  it("analyzes free-form task descriptions", () => {
    const result = analyzeTask("Add GraphQL schema and resolver for billing");
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.agent.name.length).toBeGreaterThan(0);
  });
});
