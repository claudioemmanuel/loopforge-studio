import { describe, it, expect } from "vitest";
import {
  routeTaskToAgent,
  routeTasks,
  analyzeTask,
  explainRouting,
  isReviewTask,
  isTestTask,
} from "../lib/agents/router";
import { getAllAgents, Agents, getAgent } from "../lib/agents/registry";
import type { PlanStep } from "../lib/agents/types";

describe("Agent Registry", () => {
  it("should have all expected agents registered", () => {
    const agents = getAllAgents();

    // Core Development (8)
    expect(getAgent("backend-developer")).toBeDefined();
    expect(getAgent("frontend-developer")).toBeDefined();
    expect(getAgent("ui-engineer")).toBeDefined();
    expect(getAgent("fullstack-developer")).toBeDefined();
    expect(getAgent("mobile-developer")).toBeDefined();
    expect(getAgent("api-designer")).toBeDefined();
    expect(getAgent("graphql-architect")).toBeDefined();
    expect(getAgent("microservices-architect")).toBeDefined();

    // Language Specialists (5)
    expect(getAgent("typescript-expert")).toBeDefined();
    expect(getAgent("python-specialist")).toBeDefined();
    expect(getAgent("go-specialist")).toBeDefined();
    expect(getAgent("rust-specialist")).toBeDefined();
    expect(getAgent("swift-expert")).toBeDefined();

    // Quality & Security (6)
    expect(getAgent("code-reviewer")).toBeDefined();
    expect(getAgent("test-automator")).toBeDefined();
    expect(getAgent("qa-expert")).toBeDefined();
    expect(getAgent("security-auditor")).toBeDefined();
    expect(getAgent("performance-engineer")).toBeDefined();
    expect(getAgent("debugger")).toBeDefined();

    // Infrastructure (4)
    expect(getAgent("devops-engineer")).toBeDefined();
    expect(getAgent("database-optimizer")).toBeDefined();
    expect(getAgent("database-administrator")).toBeDefined();
    expect(getAgent("kubernetes-expert")).toBeDefined();

    // Meta (3)
    expect(getAgent("multi-agent-coordinator")).toBeDefined();
    expect(getAgent("refactoring-specialist")).toBeDefined();
    expect(getAgent("documentation-engineer")).toBeDefined();

    // Total should be 26 agents
    expect(agents.length).toBe(26);
  });

  it("should have unique IDs for all agents", () => {
    const agents = getAllAgents();
    const ids = agents.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have keywords for all agents", () => {
    const agents = getAllAgents();
    for (const agent of agents) {
      expect(agent.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe("Agent Router", () => {
  describe("routeTaskToAgent", () => {
    it("should route API tasks to backend-developer", () => {
      const task: PlanStep = {
        id: "1",
        title: "Create REST API endpoint for user preferences",
        description: "Implement GET and PUT endpoints for user preference settings",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("backend-developer");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should route database tasks to database-administrator", () => {
      const task: PlanStep = {
        id: "2",
        title: "Create database migration for user table",
        description: "Add new columns to the user schema for profile settings",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(["database-administrator", "backend-developer"]).toContain(result.agent.id);
    });

    it("should route UI component tasks to ui-engineer", () => {
      const task: PlanStep = {
        id: "3",
        title: "Create reusable Button component",
        description: "Build an accessible button component with multiple variants and dark mode support",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("ui-engineer");
    });

    it("should route test tasks to test-automator", () => {
      const task: PlanStep = {
        id: "4",
        title: "Write unit tests for authentication service",
        description: "Add Jest tests for login, logout, and token refresh flows",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("test-automator");
    });

    it("should route React component tasks to frontend-developer or ui-engineer", () => {
      const task: PlanStep = {
        id: "5",
        title: "Build React dashboard page",
        description: "Create a dashboard page with charts and data fetching",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(["frontend-developer", "ui-engineer"]).toContain(result.agent.id);
    });

    it("should route security tasks to security-auditor", () => {
      const task: PlanStep = {
        id: "6",
        title: "Implement authentication middleware",
        description: "Add JWT validation and authorization checks for API routes",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(["security-auditor", "backend-developer"]).toContain(result.agent.id);
    });

    it("should route CI/CD tasks to devops-engineer", () => {
      const task: PlanStep = {
        id: "7",
        title: "Set up GitHub Actions pipeline",
        description: "Create CI/CD pipeline with build, test, and deploy stages",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("devops-engineer");
    });

    it("should route performance tasks to performance-engineer", () => {
      const task: PlanStep = {
        id: "8",
        title: "Optimize slow database queries",
        description: "Profile and fix N+1 queries causing performance issues",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(["performance-engineer", "database-optimizer"]).toContain(result.agent.id);
    });

    it("should route TypeScript type tasks to typescript-expert", () => {
      const task: PlanStep = {
        id: "9",
        title: "Fix TypeScript generic inference",
        description: "Resolve type errors in utility function with conditional types",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("typescript-expert");
    });

    it("should route GraphQL tasks to graphql-architect", () => {
      const task: PlanStep = {
        id: "10",
        title: "Design GraphQL schema for products",
        description: "Create types, queries, and mutations for product catalog",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("graphql-architect");
    });

    it("should fall back to fullstack-developer for generic tasks", () => {
      const task: PlanStep = {
        id: "11",
        title: "Implement new feature",
        description: "Build the functionality as specified",
        dependencies: [],
      };

      const result = routeTaskToAgent(task);
      expect(result.agent.id).toBe("fullstack-developer");
    });

    it("should respect manual overrides", () => {
      const task: PlanStep = {
        id: "12",
        title: "Write backend code",
        description: "Implement server logic",
        dependencies: [],
      };

      const result = routeTaskToAgent(task, {
        overrides: { "12": "debugger" },
      });
      expect(result.agent.id).toBe("debugger");
      expect(result.reason).toBe("Manual override specified");
    });

    it("should exclude specified agents", () => {
      const task: PlanStep = {
        id: "13",
        title: "Create API endpoint",
        description: "Build REST endpoint",
        dependencies: [],
      };

      const result = routeTaskToAgent(task, {
        excludeAgents: ["backend-developer"],
      });
      expect(result.agent.id).not.toBe("backend-developer");
    });
  });

  describe("routeTasks", () => {
    it("should route multiple tasks and return a map", () => {
      const tasks: PlanStep[] = [
        {
          id: "1",
          title: "Create API endpoint",
          description: "REST API for users",
          dependencies: [],
        },
        {
          id: "2",
          title: "Build React component",
          description: "User profile UI",
          dependencies: ["1"],
        },
        {
          id: "3",
          title: "Write tests",
          description: "Unit tests for the feature",
          dependencies: ["1", "2"],
        },
      ];

      const results = routeTasks(tasks);

      expect(results.size).toBe(3);
      expect(results.get("1")).toBeDefined();
      expect(results.get("2")).toBeDefined();
      expect(results.get("3")).toBeDefined();
    });
  });

  describe("analyzeTask", () => {
    it("should analyze a task description and suggest an agent", () => {
      const result = analyzeTask("Create a Docker container for the application");
      expect(["devops-engineer", "kubernetes-expert"]).toContain(result.agent.id);
    });
  });

  describe("isReviewTask", () => {
    it("should detect review tasks", () => {
      const task: PlanStep = {
        id: "1",
        title: "Review code changes",
        description: "Check for security issues",
        dependencies: [],
      };

      expect(isReviewTask(task)).toBe(true);
    });

    it("should not detect non-review tasks", () => {
      const task: PlanStep = {
        id: "1",
        title: "Create API endpoint",
        description: "Build new feature",
        dependencies: [],
      };

      expect(isReviewTask(task)).toBe(false);
    });
  });

  describe("isTestTask", () => {
    it("should detect test tasks", () => {
      const task: PlanStep = {
        id: "1",
        title: "Write unit tests",
        description: "Add Jest tests for auth module",
        dependencies: [],
      };

      expect(isTestTask(task)).toBe(true);
    });

    it("should detect e2e test tasks", () => {
      const task: PlanStep = {
        id: "1",
        title: "Add end-to-end tests",
        description: "Playwright tests for checkout flow",
        dependencies: [],
      };

      expect(isTestTask(task)).toBe(true);
    });
  });

  describe("explainRouting", () => {
    it("should provide routing explanation", () => {
      const task: PlanStep = {
        id: "1",
        title: "Create database migration",
        description: "Add user preferences table",
        dependencies: [],
      };

      const explanation = explainRouting(task);
      expect(explanation).toContain("Task:");
      expect(explanation).toContain("Agent Scores:");
      expect(explanation).toContain("Selected:");
    });
  });
});
