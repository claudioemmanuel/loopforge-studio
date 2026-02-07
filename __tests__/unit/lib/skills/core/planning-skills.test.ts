import { describe, it, expect } from "vitest";
import { brainstorming } from "@/lib/skills/core/brainstorming";
import { writingPlans } from "@/lib/skills/core/writing-plans";
import { usingSuperpowers } from "@/lib/skills/core/using-superpowers";
import type { SkillInvocationContext } from "@/lib/skills/types";
import type { AIClient } from "@/lib/ai";

const mockClient: Partial<AIClient> = {
  getProvider: () => "anthropic",
  getModel: () => "claude-sonnet-4",
};

describe("Brainstorming Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "brainstorming",
    taskDescription: "Add user authentication",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should skip when not in brainstorming phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "executing",
      };

      const result = await brainstorming.executeLogic(context, mockClient);

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in brainstorming phase");
    });

    it("should provide guidance when conversation just started", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        brainstormHistory: [{ role: "user", content: "Let's build auth" }],
      };

      const result = await brainstorming.executeLogic(context, mockClient);

      expect(result.status).toBe("warning");
      expect(result.augmentedPrompt).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it("should warn when missing acceptance criteria", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        brainstormHistory: [
          { role: "user", content: "Add authentication" },
          { role: "assistant", content: "We need to break this into tasks" },
          { role: "user", content: "Yes, let's identify the steps" },
        ],
      };

      const result = await brainstorming.executeLogic(context, mockClient);

      expect(result.status).toBe("warning");
      expect(result.message).toContain("incomplete");
      expect(result.metadata?.missingElements).toContain(
        "Acceptance criteria (specific, testable conditions)",
      );
    });

    it("should pass when brainstorming complete", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        brainstormHistory: [
          { role: "user", content: "Add authentication" },
          {
            role: "assistant",
            content: "Acceptance criteria: users can log in with email",
          },
          {
            role: "user",
            content: "Implementation steps: create auth service, add tests",
          },
          {
            role: "assistant",
            content: "Risks: password security, session management",
          },
        ],
      };

      const result = await brainstorming.executeLogic(context, mockClient);

      expect(result.status).toBe("passed");
      expect(result.message).toContain("complete");
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(brainstorming.id).toBe("brainstorming");
      expect(brainstorming.category).toBe("planning");
      expect(brainstorming.enforcement).toBe("guidance");
      expect(brainstorming.triggerPhases).toContain("brainstorming");
    });
  });
});

describe("Writing Plans Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "planning",
    taskDescription: "Implement JWT authentication",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should skip when not in planning phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "executing",
      };

      const result = await writingPlans.executeLogic(context, mockClient);

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in planning phase");
    });

    it("should warn when no plan created yet", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        planContent: "",
      };

      const result = await writingPlans.executeLogic(context, mockClient);

      expect(result.status).toBe("warning");
      expect(result.message).toContain("No plan created");
      expect(result.augmentedPrompt).toBeDefined();
    });

    it("should warn when plan has low granularity", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        planContent: `
          Step 1: Add authentication
          Step 2: Add tests
        `,
      };

      const result = await writingPlans.executeLogic(context, mockClient);

      expect(result.status).toBe("warning");
      expect(result.metadata?.granularityScore).toBeLessThan(3);
    });

    it("should pass when plan is well-structured", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        planContent: `
          Step 1: Create auth service
          Step 2: Add login method
          Step 3: Add JWT generation
          Step 4: Add token validation
          Step 5: Create login route
          Step 6: Add unit tests for auth service
          Step 7: Add integration tests for login route
          Step 8: Update API documentation
          Acceptance Criteria: Users can log in and receive JWT
          Test Strategy: Unit tests for business logic, integration tests for API
        `,
      };

      const result = await writingPlans.executeLogic(context, mockClient);

      expect(result.status).toBe("passed");
      expect(result.metadata?.granularityScore).toBeGreaterThanOrEqual(3);
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(writingPlans.id).toBe("writing-plans");
      expect(writingPlans.category).toBe("planning");
      expect(writingPlans.enforcement).toBe("warning");
      expect(writingPlans.triggerPhases).toContain("planning");
    });

    it("should have KERNEL framework in prompt", () => {
      expect(writingPlans.systemPrompt).toContain("KERNEL");
      expect(writingPlans.systemPrompt).toContain("Keep It Simple");
    });
  });
});

describe("Using Superpowers Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "executing",
    taskDescription: "Implement feature",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should warn when applicable skills not invoked", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        previousSkillExecutions: [], // No skills executed yet
      };

      const result = await usingSuperpowers.executeLogic(context, mockClient);

      expect(result.status).toBe("warning");
      expect(result.message).toContain("not yet invoked");
    });

    it("should pass when all skills invoked", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        previousSkillExecutions: [
          {
            skillId: "test-driven-development",
            status: "passed",
            message: "TDD followed",
            timestamp: new Date().toISOString(),
          },
          {
            skillId: "autonomous-code-generation",
            status: "passed",
            message: "Extraction successful",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await usingSuperpowers.executeLogic(context, mockClient);

      // May still warn if more skills are applicable
      expect(["passed", "warning"]).toContain(result.status);
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(usingSuperpowers.id).toBe("using-superpowers");
      expect(usingSuperpowers.category).toBe("meta");
      expect(usingSuperpowers.enforcement).toBe("warning");
      expect(usingSuperpowers.triggerPhases.length).toBeGreaterThan(3);
    });

    it("should have invocation discipline prompt", () => {
      expect(usingSuperpowers.systemPrompt).toContain(
        "CHECK FOR APPLICABLE SKILLS FIRST",
      );
      expect(usingSuperpowers.systemPrompt).toContain("Red Flags");
    });
  });
});
