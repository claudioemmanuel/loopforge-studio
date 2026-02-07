import { describe, it, expect } from "vitest";
import { systematicDebugging } from "@/lib/skills/core/systematic-debugging";
import type { SkillInvocationContext } from "@/lib/skills/types";
import type { AIClient } from "@/lib/ai";

describe("Systematic Debugging Skill", () => {
  const mockClient: Partial<AIClient> = {
    getProvider: () => "anthropic",
    getModel: () => "claude-sonnet-4",
  };

  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "stuck",
    taskDescription: "Debug authentication issue",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should pass when not in stuck state and no stuck signals", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "planning",
        stuckSignals: undefined,
      };

      const result = await systematicDebugging.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("No debugging needed");
    });

    it("should warn when stuck but no clear signals", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "stuck",
        stuckSignals: [],
      };

      const result = await systematicDebugging.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("warning");
      expect(result.message).toContain("no clear signals");
      expect(result.recommendations).toContain("Review recent changes");
    });

    it("should block when stuck signals present but no investigation", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "stuck",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
            metadata: { errorCount: 3 },
          },
        ],
        metadata: {}, // No investigation metadata
      };

      const result = await systematicDebugging.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("blocked");
      expect(result.message).toContain("BLOCKED");
      expect(result.message).toContain("without root cause investigation");
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.length).toBeGreaterThan(0);
    });

    it("should block when partial investigation (missing steps)", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "executing",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
          },
        ],
        metadata: {
          errorAnalysis: "TypeError: Cannot read property 'id'",
          // Missing: hypothesis and verification
        },
      };

      const result = await systematicDebugging.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("blocked");
      expect(result.recommendations).toContain(
        "Hypothesis about root cause (what, why, how to verify)",
      );
      expect(result.recommendations).toContain(
        "Verification of hypothesis (test, log output, reproduction)",
      );
    });

    it("should pass when complete investigation performed", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "stuck",
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

      const result = await systematicDebugging.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("investigation complete");
      expect(result.metadata?.investigationComplete).toBe(true);
    });

    it("should analyze different stuck signal types", async () => {
      const signals = [
        {
          type: "consecutive_errors",
          severity: "high",
          confidence: 0.95,
          evidence: "3 errors",
        },
        {
          type: "repeated_patterns",
          severity: "medium",
          confidence: 0.8,
          evidence: "Identical output",
        },
        {
          type: "no_progress",
          severity: "medium",
          confidence: 0.7,
          evidence: "No commits",
        },
      ];

      const context: SkillInvocationContext = {
        ...baseContext,
        stuckSignals: signals,
        metadata: {},
      };

      const result = await systematicDebugging.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("blocked");
      expect(result.metadata?.rootCauses).toBeDefined();
      expect(result.metadata?.evidenceNeeded).toBeDefined();
    });
  });

  describe("metadata", () => {
    it("should have correct skill metadata", () => {
      expect(systematicDebugging.id).toBe("systematic-debugging");
      expect(systematicDebugging.category).toBe("debugging");
      expect(systematicDebugging.enforcement).toBe("blocking");
      expect(systematicDebugging.triggerPhases).toContain("stuck");
      expect(systematicDebugging.triggerPhases).toContain("executing");
    });

    it("should have comprehensive system prompt", () => {
      expect(systematicDebugging.systemPrompt).toContain(
        "UNDERSTAND BEFORE YOU FIX",
      );
      expect(systematicDebugging.systemPrompt).toContain("Scientific Method");
      expect(systematicDebugging.systemPrompt).toContain("OBSERVE");
      expect(systematicDebugging.systemPrompt).toContain("HYPOTHESIZE");
    });
  });
});
