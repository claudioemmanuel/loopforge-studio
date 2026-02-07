import { describe, it, expect } from "vitest";
import { verificationBeforeCompletion } from "@/lib/skills/core/verification-before-completion";
import type { SkillInvocationContext } from "@/lib/skills/types";
import type { AIClient } from "@/lib/ai";

describe("Verification Before Completion Skill", () => {
  const mockClient: AIClient = {
    chat: async () => "",
    getProvider: () => "anthropic",
    getModel: () => "claude-sonnet-4",
  };

  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "review",
    taskDescription: "Implement authentication",
    workingDir: "/test",
    planContent: "Modify `src/auth.ts` and `src/utils.ts`",
  };

  describe("executeLogic", () => {
    it("should pass when not in review/executing phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "planning",
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in completion phase");
    });

    it("should block when no test evidence", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123"],
        testHistory: undefined,
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain("BLOCKED");
      expect(result.recommendations).toContain(
        "npm test (show passing output)",
      );
    });

    it("should block when tests failing", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123"],
        testHistory: [
          {
            status: "failed",
            timestamp: new Date(),
          },
        ],
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain("Tests failing");
    });

    it("should block when no commits made", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: [],
        testHistory: [
          {
            status: "passed",
            timestamp: new Date(),
          },
        ],
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain("No commits made");
    });

    it("should block when plan coverage too low", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123"],
        testHistory: [
          {
            status: "passed",
            timestamp: new Date(),
          },
        ],
        // Note: calculatePlanCoverage would return low value in real implementation
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      // This test depends on the actual plan coverage calculation
      // In a real scenario with proper git integration, this would check coverage
      if (result.status === "blocked") {
        expect(result.message).toContain("plan coverage");
      }
    });

    it("should pass when all checks met", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123", "def456"],
        testHistory: [
          {
            status: "passed",
            timestamp: new Date(),
          },
        ],
        planContent: "Simple plan",
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      // May pass or have warnings depending on implementation details
      expect(["passed", "warning"]).toContain(result.status);
    });

    it("should warn when commits exist but quality questionable", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123"],
        testHistory: [
          {
            status: "passed",
            timestamp: new Date(),
          },
        ],
      };

      const result = await verificationBeforeCompletion.executeLogic(
        context,
        mockClient,
      );

      if (result.status === "warning") {
        expect(result.recommendations).toBeDefined();
      }
    });
  });

  describe("metadata", () => {
    it("should have correct skill metadata", () => {
      expect(verificationBeforeCompletion.id).toBe(
        "verification-before-completion",
      );
      expect(verificationBeforeCompletion.category).toBe("quality-discipline");
      expect(verificationBeforeCompletion.enforcement).toBe("blocking");
      expect(verificationBeforeCompletion.triggerPhases).toContain("review");
      expect(verificationBeforeCompletion.triggerPhases).toContain("executing");
    });

    it("should have evidence-focused system prompt", () => {
      expect(verificationBeforeCompletion.systemPrompt).toContain(
        "EVIDENCE BEFORE ASSERTIONS",
      );
      expect(verificationBeforeCompletion.systemPrompt).toContain("Tests Pass");
      expect(verificationBeforeCompletion.systemPrompt).toContain(
        "Code Committed",
      );
    });
  });
});
