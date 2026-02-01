import { describe, it, expect } from "vitest";
import { testDrivenDevelopment } from "@/lib/skills/core/test-driven-development";
import type { SkillInvocationContext } from "@/lib/skills/types";

describe("Test-Driven Development Skill", () => {
  const mockClient: any = {
    getProvider: () => "anthropic",
    getModel: () => "claude-sonnet-4",
  };

  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "executing",
    taskDescription: "Test task",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should pass when no files modified", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: [],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("No files modified");
    });

    it("should pass when only test files modified", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: ["src/utils.test.ts", "__tests__/auth.test.ts"],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Only test files modified");
    });

    it("should block when production code modified without tests", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: ["src/auth/login.ts"],
        testHistory: [],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain("BLOCKED");
      expect(result.message).toContain("without corresponding tests");
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.length).toBeGreaterThan(0);
    });

    it("should block when test file exists but not executed", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: ["src/auth/login.ts", "__tests__/auth/login.test.ts"],
        testHistory: [], // No test execution
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain("Tests not executed");
      expect(result.recommendations).toContain(
        "Run: npm test (or appropriate test command)"
      );
    });

    it("should block when tests pass immediately (no RED state)", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: ["src/auth/login.ts", "__tests__/auth/login.test.ts"],
        testHistory: [
          {
            status: "passed",
            timestamp: new Date("2026-01-29T10:00:00Z"),
          },
        ],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain(
        "Tests passing immediately. Must observe RED state first"
      );
    });

    it("should warn when tests still failing (not yet GREEN)", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: ["src/auth/login.ts", "__tests__/auth/login.test.ts"],
        testHistory: [
          {
            status: "failed",
            timestamp: new Date("2026-01-29T10:00:00Z"),
          },
          {
            status: "failed",
            timestamp: new Date("2026-01-29T10:05:00Z"),
          },
        ],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("warning");
      expect(result.message).toContain("Tests still failing");
    });

    it("should pass when TDD cycle followed correctly (RED → GREEN)", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        modifiedFiles: ["src/auth/login.ts", "__tests__/auth/login.test.ts"],
        testHistory: [
          {
            status: "failed", // RED state
            timestamp: new Date("2026-01-29T10:00:00Z"),
          },
          {
            status: "passed", // GREEN state
            timestamp: new Date("2026-01-29T10:05:00Z"),
          },
        ],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("TDD cycle followed correctly");
      expect(result.metadata?.cycleComplete).toBe(true);
    });

    it("should skip validation when not in executing phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "planning",
        modifiedFiles: ["src/auth/login.ts"],
      };

      const result = await testDrivenDevelopment.executeLogic(
        context,
        mockClient
      );

      expect(result.status).toBe("passed");
    });
  });

  describe("metadata", () => {
    it("should have correct skill metadata", () => {
      expect(testDrivenDevelopment.id).toBe("test-driven-development");
      expect(testDrivenDevelopment.category).toBe("quality-discipline");
      expect(testDrivenDevelopment.enforcement).toBe("blocking");
      expect(testDrivenDevelopment.triggerPhases).toContain("executing");
    });

    it("should have non-empty system prompt", () => {
      expect(testDrivenDevelopment.systemPrompt).toBeTruthy();
      expect(testDrivenDevelopment.systemPrompt.length).toBeGreaterThan(100);
      expect(testDrivenDevelopment.systemPrompt).toContain("TDD");
    });
  });
});
