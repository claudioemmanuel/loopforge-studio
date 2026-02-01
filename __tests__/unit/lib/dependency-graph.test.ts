import { describe, it, expect } from "vitest";
import {
  buildDependencyGraph,
  validateGraph,
  getReadyTasks,
  markTaskRunning,
  markTaskCompleted,
  markTaskFailed,
  skipDependentTasks,
  isGraphComplete,
  hasIncompleteTasks,
  getProgress,
  getTopologicalOrder,
  getParallelGroups,
  parsePlan,
} from "../lib/ralph/dependency-graph";
import type { PlanStep } from "../lib/agents/types";

describe("Dependency Graph", () => {
  const createTestSteps = (): PlanStep[] => [
    {
      id: "step-1",
      title: "Setup database",
      description: "Create database schema",
      dependencies: [],
    },
    {
      id: "step-2",
      title: "Create API endpoints",
      description: "Build REST API",
      dependencies: ["step-1"],
    },
    {
      id: "step-3",
      title: "Build UI components",
      description: "Create React components",
      dependencies: ["step-1"],
    },
    {
      id: "step-4",
      title: "Integration",
      description: "Connect UI to API",
      dependencies: ["step-2", "step-3"],
    },
    {
      id: "step-5",
      title: "Testing",
      description: "Write tests",
      dependencies: ["step-4"],
    },
  ];

  describe("buildDependencyGraph", () => {
    it("should create a graph from steps", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      expect(graph.nodes.size).toBe(5);
      expect(graph.roots).toContain("step-1");
      expect(graph.roots.length).toBe(1);
    });

    it("should identify multiple roots", () => {
      const steps: PlanStep[] = [
        { id: "a", title: "A", description: "", dependencies: [] },
        { id: "b", title: "B", description: "", dependencies: [] },
        { id: "c", title: "C", description: "", dependencies: ["a", "b"] },
      ];

      const graph = buildDependencyGraph(steps);
      expect(graph.roots).toContain("a");
      expect(graph.roots).toContain("b");
      expect(graph.roots.length).toBe(2);
    });

    it("should build dependents correctly", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      const step1 = graph.nodes.get("step-1")!;
      expect(step1.dependents).toContain("step-2");
      expect(step1.dependents).toContain("step-3");

      const step2 = graph.nodes.get("step-2")!;
      expect(step2.dependents).toContain("step-4");
    });
  });

  describe("validateGraph", () => {
    it("should validate a valid graph", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);
      const result = validateGraph(graph);

      expect(result.valid).toBe(true);
      expect(graph.validated).toBe(true);
    });

    it("should detect cycles", () => {
      const steps: PlanStep[] = [
        { id: "a", title: "A", description: "", dependencies: ["c"] },
        { id: "b", title: "B", description: "", dependencies: ["a"] },
        { id: "c", title: "C", description: "", dependencies: ["b"] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = validateGraph(graph);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cycle detected");
    });
  });

  describe("getReadyTasks", () => {
    it("should return root tasks initially", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      const ready = getReadyTasks(graph);
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe("step-1");
    });

    it("should return tasks whose dependencies are complete", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      markTaskCompleted(graph, "step-1");

      const ready = getReadyTasks(graph);
      expect(ready.length).toBe(2);
      expect(ready.map((t) => t.id)).toContain("step-2");
      expect(ready.map((t) => t.id)).toContain("step-3");
    });

    it("should not return running tasks", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      markTaskRunning(graph, "step-1");

      const ready = getReadyTasks(graph);
      expect(ready.length).toBe(0);
    });
  });

  describe("skipDependentTasks", () => {
    it("should skip tasks that depend on failed task", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      markTaskCompleted(graph, "step-1");
      markTaskFailed(graph, "step-2");

      const skipped = skipDependentTasks(graph, "step-2");

      // step-4 and step-5 depend (transitively) on step-2
      expect(skipped).toContain("step-4");
      expect(skipped).toContain("step-5");

      const step4 = graph.nodes.get("step-4")!;
      expect(step4.status).toBe("skipped");
    });
  });

  describe("getProgress", () => {
    it("should return correct progress counts", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      markTaskCompleted(graph, "step-1");
      markTaskRunning(graph, "step-2");
      markTaskFailed(graph, "step-3");

      const progress = getProgress(graph);

      expect(progress.total).toBe(5);
      expect(progress.completed).toBe(1);
      expect(progress.running).toBe(1);
      expect(progress.failed).toBe(1);
      expect(progress.pending).toBe(2);
      expect(progress.progressPercent).toBe(40); // 2 done out of 5
    });
  });

  describe("isGraphComplete", () => {
    it("should return false when tasks are pending", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      expect(isGraphComplete(graph)).toBe(false);
    });

    it("should return true when all tasks are done", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      for (const step of steps) {
        markTaskCompleted(graph, step.id);
      }

      expect(isGraphComplete(graph)).toBe(true);
    });
  });

  describe("getTopologicalOrder", () => {
    it("should return valid topological order", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      const order = getTopologicalOrder(graph);

      expect(order.length).toBe(5);

      // step-1 must come before step-2 and step-3
      expect(order.indexOf("step-1")).toBeLessThan(order.indexOf("step-2"));
      expect(order.indexOf("step-1")).toBeLessThan(order.indexOf("step-3"));

      // step-2 and step-3 must come before step-4
      expect(order.indexOf("step-2")).toBeLessThan(order.indexOf("step-4"));
      expect(order.indexOf("step-3")).toBeLessThan(order.indexOf("step-4"));

      // step-4 must come before step-5
      expect(order.indexOf("step-4")).toBeLessThan(order.indexOf("step-5"));
    });
  });

  describe("getParallelGroups", () => {
    it("should group tasks by execution depth", () => {
      const steps = createTestSteps();
      const graph = buildDependencyGraph(steps);

      const groups = getParallelGroups(graph);

      // Group 0: step-1 (no deps)
      // Group 1: step-2, step-3 (depend on step-1)
      // Group 2: step-4 (depends on step-2, step-3)
      // Group 3: step-5 (depends on step-4)

      expect(groups.length).toBe(4);
      expect(groups[0]).toContain("step-1");
      expect(groups[1]).toContain("step-2");
      expect(groups[1]).toContain("step-3");
      expect(groups[2]).toContain("step-4");
      expect(groups[3]).toContain("step-5");
    });

    it("should handle fully parallel tasks", () => {
      const steps: PlanStep[] = [
        { id: "a", title: "A", description: "", dependencies: [] },
        { id: "b", title: "B", description: "", dependencies: [] },
        { id: "c", title: "C", description: "", dependencies: [] },
      ];

      const graph = buildDependencyGraph(steps);
      const groups = getParallelGroups(graph);

      expect(groups.length).toBe(1);
      expect(groups[0].length).toBe(3);
    });
  });
});

describe("Plan Parsing", () => {
  describe("parsePlan - JSON format", () => {
    it("should parse JSON plan with steps", () => {
      const planContent = JSON.stringify({
        title: "Feature Implementation",
        description: "Build new feature",
        steps: [
          {
            id: "setup",
            title: "Setup",
            description: "Initial setup",
            dependencies: [],
          },
          {
            id: "implement",
            title: "Implement",
            description: "Build feature",
            dependencies: ["setup"],
          },
        ],
      });

      const plan = parsePlan(planContent);

      expect(plan.title).toBe("Feature Implementation");
      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].id).toBe("setup");
      expect(plan.steps[1].dependencies).toContain("setup");
    });

    it("should handle JSON without dependencies", () => {
      const planContent = JSON.stringify({
        steps: [
          { id: "1", title: "Step 1", description: "Do something" },
          { id: "2", title: "Step 2", description: "Do something else" },
        ],
      });

      const plan = parsePlan(planContent);

      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].dependencies).toEqual([]);
      expect(plan.steps[1].dependencies).toEqual([]);
    });
  });

  describe("parsePlan - Markdown format", () => {
    it("should parse numbered markdown list", () => {
      const planContent = `
1. Create database schema
2. Build API endpoints
3. Create UI components
4. Write tests
      `;

      const plan = parsePlan(planContent);

      expect(plan.steps.length).toBe(4);
      expect(plan.steps[0].title).toBe("Create database schema");
      expect(plan.steps[3].title).toBe("Write tests");
    });

    it("should parse bullet point list", () => {
      const planContent = `
- Setup project structure
- Install dependencies
- Configure build tools
      `;

      const plan = parsePlan(planContent);

      expect(plan.steps.length).toBe(3);
      expect(plan.steps[0].title).toBe("Setup project structure");
    });

    it("should create sequential dependencies for markdown lists", () => {
      const planContent = `
1. First step
2. Second step
3. Third step
      `;

      const plan = parsePlan(planContent);

      expect(plan.steps[0].dependencies).toEqual([]);
      expect(plan.steps[1].dependencies).toEqual(["step-1"]);
      expect(plan.steps[2].dependencies).toEqual(["step-2"]);
    });
  });

  describe("parsePlan - Plain text", () => {
    it("should treat plain text as single step", () => {
      const planContent = "Implement the user authentication feature";

      const plan = parsePlan(planContent);

      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].description).toBe(planContent);
    });
  });
});
