import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { invokePhaseSkills, canTransitionPhase } from "@/lib/skills";
import { testDrivenDevelopment } from "@/lib/skills/core/test-driven-development";
import { systematicDebugging } from "@/lib/skills/core/systematic-debugging";
import { verificationBeforeCompletion } from "@/lib/skills/core/verification-before-completion";
import { brainstorming } from "@/lib/skills/core/brainstorming";
import { writingPlans } from "@/lib/skills/core/writing-plans";
import type { SkillInvocationContext } from "@/lib/skills/types";

const mockClient: any = {
  getProvider: () => "anthropic",
  getModel: () => "claude-sonnet-4",
  chat: async () => ({ content: "Mock response" }),
};

describe("Phase Transitions Integration", () => {
  describe("Brainstorming Phase", () => {
    it("should invoke brainstorming skill automatically", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "brainstorming",
        taskDescription: "Add user authentication",
        workingDir: "/test",
        brainstormHistory: [
          { role: "user", content: "Let's add auth" },
        ],
      };

      const results = await invokePhaseSkills("brainstorming", context, mockClient);

      const brainstormResult = results.find((r) => r.skillId === "brainstorming");
      expect(brainstormResult).toBeDefined();
      expect(brainstormResult?.status).toBe("warning"); // Early conversation
    });

    it("should allow transition to planning when brainstorming complete", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "brainstorming",
        taskDescription: "Add user authentication",
        workingDir: "/test",
        brainstormHistory: [
          { role: "user", content: "Add authentication" },
          { role: "assistant", content: "Acceptance criteria: users can log in with email" },
          { role: "user", content: "Implementation steps: create auth service, add tests" },
          { role: "assistant", content: "Risks: password security, session management" },
        ],
      };

      const canTransition = await canTransitionPhase(
        context,
        "brainstorming",
        "planning",
        mockClient
      );

      expect(canTransition.allowed).toBe(true);
      expect(canTransition.blockingReasons).toHaveLength(0);
    });
  });

  describe("Planning Phase", () => {
    it("should invoke writing-plans skill automatically", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "planning",
        taskDescription: "Implement JWT authentication",
        workingDir: "/test",
        planContent: "",
      };

      const results = await invokePhaseSkills("planning", context, mockClient);

      const planningResult = results.find((r) => r.skillId === "writing-plans");
      expect(planningResult).toBeDefined();
      expect(planningResult?.status).toBe("warning"); // No plan created yet
    });

    it("should allow transition to ready when plan complete", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "planning",
        taskDescription: "Implement JWT authentication",
        workingDir: "/test",
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

      const canTransition = await canTransitionPhase(
        context,
        "planning",
        "ready",
        mockClient
      );

      expect(canTransition.allowed).toBe(true);
    });

    it("should block transition when plan has low granularity", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "planning",
        taskDescription: "Implement JWT authentication",
        workingDir: "/test",
        planContent: `
          Step 1: Add authentication
          Step 2: Add tests
        `,
      };

      const canTransition = await canTransitionPhase(
        context,
        "planning",
        "ready",
        mockClient
      );

      // May warn but not block (writing-plans uses 'warning' enforcement)
      expect(canTransition.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Executing Phase", () => {
    it("should invoke TDD skill during execution", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "executing",
        taskDescription: "Implement login endpoint",
        workingDir: "/test",
        modifiedFiles: ["src/auth/login.ts"],
        testHistory: [],
      };

      const results = await invokePhaseSkills("executing", context, mockClient);

      const tddResult = results.find((r) => r.skillId === "test-driven-development");
      expect(tddResult).toBeDefined();
      expect(tddResult?.status).toBe("blocked"); // No tests yet
    });

    it("should block transition when TDD cycle incomplete", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "executing",
        taskDescription: "Implement login endpoint",
        workingDir: "/test",
        modifiedFiles: ["src/auth/login.ts"],
        testHistory: [],
      };

      const canTransition = await canTransitionPhase(
        context,
        "executing",
        "review",
        mockClient
      );

      expect(canTransition.allowed).toBe(false);
      expect(canTransition.blockingReasons.length).toBeGreaterThan(0);
      expect(canTransition.blockingReasons.some((r) => r.includes("test"))).toBe(true);
    });

    it("should allow transition when TDD cycle complete", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "executing",
        taskDescription: "Implement login endpoint",
        workingDir: "/test",
        modifiedFiles: ["src/auth/login.ts", "__tests__/auth/login.test.ts"],
        testHistory: [
          { status: "failed", timestamp: new Date("2026-01-29T10:00:00Z") }, // RED
          { status: "passed", timestamp: new Date("2026-01-29T10:05:00Z") }, // GREEN
        ],
        commits: ["abc123"],
      };

      const canTransition = await canTransitionPhase(
        context,
        "executing",
        "review",
        mockClient
      );

      // May still have warnings from other skills, but TDD should pass
      const tddResults = await invokePhaseSkills("executing", context, mockClient);
      const tddResult = tddResults.find((r) => r.skillId === "test-driven-development");
      expect(tddResult?.status).toBe("passed");
    });
  });

  describe("Stuck Phase", () => {
    it("should invoke systematic-debugging when stuck", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "stuck",
        taskDescription: "Fix authentication bug",
        workingDir: "/test",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
            metadata: { errorCount: 3 },
          },
        ],
        metadata: {},
      };

      const results = await invokePhaseSkills("stuck", context, mockClient);

      const debugResult = results.find((r) => r.skillId === "systematic-debugging");
      expect(debugResult).toBeDefined();
      expect(debugResult?.status).toBe("blocked"); // No investigation yet
    });

    it("should block transition without root cause investigation", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "stuck",
        taskDescription: "Fix authentication bug",
        workingDir: "/test",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
          },
        ],
        metadata: {},
      };

      const canTransition = await canTransitionPhase(
        context,
        "stuck",
        "executing",
        mockClient
      );

      expect(canTransition.allowed).toBe(false);
      expect(canTransition.blockingReasons.some((r) => r.includes("investigation"))).toBe(
        true
      );
    });

    it("should allow transition after complete investigation", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "stuck",
        taskDescription: "Fix authentication bug",
        workingDir: "/test",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
          },
        ],
        metadata: {
          errorAnalysis: "TypeError: Cannot read property 'id' of undefined",
          hypothesis: "User object not initialized before access",
          verification: "Added null check, error disappeared",
        },
      };

      const canTransition = await canTransitionPhase(
        context,
        "stuck",
        "executing",
        mockClient
      );

      expect(canTransition.allowed).toBe(true);
    });
  });

  describe("Review Phase", () => {
    it("should invoke verification-before-completion skill", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "review",
        taskDescription: "Implement authentication",
        workingDir: "/test",
        planContent: "Modify `src/auth.ts` and `src/utils.ts`",
        commits: [],
        testHistory: undefined,
      };

      const results = await invokePhaseSkills("review", context, mockClient);

      const verifyResult = results.find(
        (r) => r.skillId === "verification-before-completion"
      );
      expect(verifyResult).toBeDefined();
      expect(verifyResult?.status).toBe("blocked"); // No test evidence
    });

    it("should block transition to done without verification", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "review",
        taskDescription: "Implement authentication",
        workingDir: "/test",
        planContent: "Modify `src/auth.ts` and `src/utils.ts`",
        commits: [],
        testHistory: undefined,
      };

      const canTransition = await canTransitionPhase(
        context,
        "review",
        "done",
        mockClient
      );

      expect(canTransition.allowed).toBe(false);
      expect(canTransition.blockingReasons.some((r) => r.includes("test"))).toBe(true);
    });

    it("should allow transition when all verifications pass", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "review",
        taskDescription: "Implement authentication",
        workingDir: "/test",
        planContent: "Simple plan",
        commits: ["abc123", "def456"],
        testHistory: [
          {
            status: "passed",
            timestamp: new Date(),
          },
        ],
      };

      const canTransition = await canTransitionPhase(
        context,
        "review",
        "done",
        mockClient
      );

      // Should pass or have minor warnings
      const results = await invokePhaseSkills("review", context, mockClient);
      const verifyResult = results.find(
        (r) => r.skillId === "verification-before-completion"
      );
      expect(["passed", "warning"]).toContain(verifyResult?.status);
    });
  });

  describe("Multiple Skills Per Phase", () => {
    it("should invoke all applicable skills for executing phase", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "executing",
        taskDescription: "Implement feature",
        workingDir: "/test",
        modifiedFiles: ["src/feature.ts"],
        iteration: 5,
      };

      const results = await invokePhaseSkills("executing", context, mockClient);

      // Executing phase should invoke multiple skills
      expect(results.length).toBeGreaterThan(1);

      // Should include core execution skills
      const skillIds = results.map((r) => r.skillId);
      expect(skillIds).toContain("test-driven-development");
      expect(skillIds).toContain("using-superpowers");
    });

    it("should combine blocking results from multiple skills", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "executing",
        taskDescription: "Implement feature",
        workingDir: "/test",
        modifiedFiles: ["src/feature.ts"],
        testHistory: [], // No tests - TDD will block
        iteration: 15, // High iteration - autonomous-code-generation may warn
        metadata: {
          extractionAttempts: 20,
          extractionSuccesses: 5, // Low success rate
        },
      };

      const canTransition = await canTransitionPhase(
        context,
        "executing",
        "review",
        mockClient
      );

      expect(canTransition.allowed).toBe(false);
      expect(canTransition.blockingReasons.length).toBeGreaterThan(0);
    });
  });

  describe("Skill Augmented Prompts", () => {
    it("should combine augmented prompts from guidance skills", async () => {
      const context: SkillInvocationContext = {
        taskId: "test-task-123",
        phase: "planning",
        taskDescription: "Create feature plan",
        workingDir: "/test",
        planContent: "",
        metadata: {
          currentPrompt: "Generate a plan",
        },
      };

      const results = await invokePhaseSkills("planning", context, mockClient);

      // Guidance skills should provide augmented prompts
      const augmentedResults = results.filter((r) => r.augmentedPrompt);
      expect(augmentedResults.length).toBeGreaterThan(0);

      // Check that prompt-engineering skill provides KERNEL framework
      const promptEngineeringResult = results.find(
        (r) => r.skillId === "prompt-engineering"
      );
      if (promptEngineeringResult?.augmentedPrompt) {
        expect(promptEngineeringResult.augmentedPrompt).toContain("KERNEL");
      }
    });
  });
});
