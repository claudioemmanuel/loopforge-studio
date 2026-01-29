/**
 * Unit tests for RecoveryStrategies
 * Target coverage: 85%+
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RecoveryOrchestrator,
  FormatGuidanceStrategy,
  SimplifiedPromptStrategy,
  ContextResetStrategy,
  ManualFallbackStrategy,
  type RecoveryContext,
  type RecoveryTier,
} from "@/lib/ralph/recovery-strategies";
import type { AIClient } from "@/lib/ai/client";

// Mock AI Client
const createMockAIClient = (): AIClient =>
  ({
    chat: vi.fn().mockResolvedValue("src/main.ts"),
    getProvider: () => "anthropic",
    getModel: () => "claude-sonnet-4",
  }) as unknown as AIClient;

describe("FormatGuidanceStrategy", () => {
  let strategy: FormatGuidanceStrategy;

  beforeEach(() => {
    strategy = new FormatGuidanceStrategy();
  });

  it("should be tier format_guidance", () => {
    expect(strategy.tier).toBe("format_guidance");
  });

  it("should provide format instructions", async () => {
    const context: RecoveryContext = {
      tier: "format_guidance",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: [],
      signals: [],
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Test task",
        planContent: "Test plan",
        workingDir: "/test",
      },
      createMockAIClient(),
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("format_guidance");
    expect(result.message).toContain("format guidance");
    expect(result.modifiedContext?.systemPrompt).toBeDefined();
    expect(result.modifiedContext!.systemPrompt).toContain("FILE:");
    expect(result.modifiedContext!.systemPrompt).toContain("```");
  });
});

describe("SimplifiedPromptStrategy", () => {
  let strategy: SimplifiedPromptStrategy;

  beforeEach(() => {
    strategy = new SimplifiedPromptStrategy();
  });

  it("should be tier simplified_prompt", () => {
    expect(strategy.tier).toBe("simplified_prompt");
  });

  it("should identify focus file using AI", async () => {
    const mockClient = createMockAIClient();
    (mockClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(
      "src/components/Header.tsx",
    );

    const context: RecoveryContext = {
      tier: "simplified_prompt",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: [],
      signals: [],
      planContent: "Modify Header component",
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Update header",
        planContent: "Modify Header component in src/components/Header.tsx",
        workingDir: "/test",
      },
      mockClient,
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("simplified_prompt");
    expect(result.message).toContain("single-file");
    expect(result.modifiedContext?.systemPrompt).toContain("ONE file");
    expect(result.modifiedContext?.focusFiles).toBeDefined();
  });

  it("should handle AI failure gracefully", async () => {
    const mockClient = createMockAIClient();
    (mockClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("AI error"),
    );

    const context: RecoveryContext = {
      tier: "simplified_prompt",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: [],
      signals: [],
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Test",
        planContent: "Test plan",
        workingDir: "/test",
      },
      mockClient,
    );

    expect(result.success).toBe(true);
    expect(result.modifiedContext?.focusFiles).toEqual([]);
  });
});

describe("ContextResetStrategy", () => {
  let strategy: ContextResetStrategy;

  beforeEach(() => {
    strategy = new ContextResetStrategy();
  });

  it("should be tier context_reset", () => {
    expect(strategy.tier).toBe("context_reset");
  });

  it("should reset conversation context", async () => {
    const context: RecoveryContext = {
      tier: "context_reset",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: [],
      signals: [],
      taskDescription: "Fix bug in authentication",
      planContent: `
## Plan
- Fix login validation
- Update password hashing
- Add rate limiting
- Test all auth flows
- Document changes
`,
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Fix auth bug",
        planContent: context.planContent!,
        workingDir: "/test",
      },
      createMockAIClient(),
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("context_reset");
    expect(result.message).toContain("context");
    expect(result.modifiedContext?.systemPrompt).toContain("FRESH START");
    expect(result.modifiedContext?.conversationHistory).toEqual([]);
  });

  it("should extract key requirements from plan", async () => {
    const context: RecoveryContext = {
      tier: "context_reset",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: [],
      signals: [],
      planContent: `
- First requirement
- Second requirement
- Third requirement
- Fourth requirement (should not be included, only first 3)
`,
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Test",
        planContent: context.planContent!,
        workingDir: "/test",
      },
      createMockAIClient(),
    );

    expect(result.modifiedContext?.systemPrompt).toContain("First requirement");
    expect(result.modifiedContext?.systemPrompt).toContain(
      "Second requirement",
    );
    expect(result.modifiedContext?.systemPrompt).toContain("Third requirement");
  });
});

describe("ManualFallbackStrategy", () => {
  let strategy: ManualFallbackStrategy;

  beforeEach(() => {
    strategy = new ManualFallbackStrategy();
  });

  it("should be tier manual_fallback", () => {
    expect(strategy.tier).toBe("manual_fallback");
  });

  it("should generate manual steps using AI", async () => {
    const mockClient = createMockAIClient();
    (mockClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(`
1. Review the task requirements
2. Identify the files to modify
3. Make code changes
4. Test locally
5. Commit and push
`);

    const context: RecoveryContext = {
      tier: "manual_fallback",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: ["Error 1", "Error 2"],
      signals: [],
      taskDescription: "Implement feature X",
      planContent: "Plan details",
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Implement feature X",
        planContent: "Plan details",
        workingDir: "/test",
      },
      mockClient,
    );

    expect(result.success).toBe(false); // Manual fallback = needs user intervention
    expect(result.tier).toBe("manual_fallback");
    expect(result.message).toContain("Manual steps");
    expect(result.manualSteps).toBeDefined();
    expect(result.manualSteps!.length).toBeGreaterThan(0);
  });

  it("should provide fallback steps on AI error", async () => {
    const mockClient = createMockAIClient();
    (mockClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("AI error"),
    );

    const context: RecoveryContext = {
      tier: "manual_fallback",
      attemptNumber: 1,
      maxAttempts: 4,
      previousErrors: [],
      signals: [],
    };

    const result = await strategy.execute(
      context,
      {
        taskDescription: "Test",
        planContent: "Plan",
        workingDir: "/test",
      },
      mockClient,
    );

    expect(result.success).toBe(false);
    expect(result.manualSteps).toBeDefined();
    expect(result.manualSteps!.length).toBeGreaterThan(0);
    expect(result.manualSteps![0]).toContain("Review");
  });
});

describe("RecoveryOrchestrator", () => {
  let orchestrator: RecoveryOrchestrator;
  let mockClient: AIClient;

  beforeEach(() => {
    orchestrator = new RecoveryOrchestrator();
    mockClient = createMockAIClient();
  });

  describe("attemptRecovery()", () => {
    it("should execute recovery at specified tier", async () => {
      const context: RecoveryContext = {
        tier: "format_guidance",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: [],
        signals: [],
      };

      const result = await orchestrator.attemptRecovery(
        context,
        {
          taskDescription: "Test task",
          planContent: "Test plan",
          workingDir: "/test",
        },
        mockClient,
      );

      expect(result.success).toBe(true);
      expect(result.tier).toBe("format_guidance");
    });

    it("should escalate to next tier on failure", async () => {
      // Create a modified orchestrator with a failing tier 1
      const mockStrategy = {
        tier: "format_guidance" as RecoveryTier,
        execute: vi.fn().mockResolvedValue({
          success: false,
          tier: "format_guidance",
          message: "Failed",
        }),
      };

      // Replace strategy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (orchestrator as any).strategies.set("format_guidance", mockStrategy);

      const context: RecoveryContext = {
        tier: "format_guidance",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: [],
        signals: [],
      };

      const result = await orchestrator.attemptRecovery(
        context,
        {
          taskDescription: "Test",
          planContent: "Plan",
          workingDir: "/test",
        },
        mockClient,
      );

      // Should escalate to tier 2 (simplified_prompt)
      expect(result.tier).not.toBe("format_guidance");
    });

    it("should stop at manual_fallback", async () => {
      const context: RecoveryContext = {
        tier: "manual_fallback",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: [],
        signals: [],
      };

      const result = await orchestrator.attemptRecovery(
        context,
        {
          taskDescription: "Test",
          planContent: "Plan",
          workingDir: "/test",
        },
        mockClient,
      );

      expect(result.tier).toBe("manual_fallback");
      expect(result.success).toBe(false);
    });
  });

  describe("getRecommendedTier()", () => {
    it("should recommend simplified_prompt for timeout", () => {
      const signals = [
        {
          type: "iteration_timeout" as const,
          severity: "critical" as const,
          confidence: 1.0,
          evidence: "Timeout",
        },
      ];

      const tier = orchestrator.getRecommendedTier(signals);

      expect(tier).toBe("simplified_prompt");
    });

    it("should recommend context_reset for repeated patterns", () => {
      const signals = [
        {
          type: "repeated_pattern" as const,
          severity: "medium" as const,
          confidence: 0.7,
          evidence: "Repetition",
        },
      ];

      const tier = orchestrator.getRecommendedTier(signals);

      expect(tier).toBe("context_reset");
    });

    it("should recommend simplified_prompt for quality degradation", () => {
      const signals = [
        {
          type: "quality_degradation" as const,
          severity: "medium" as const,
          confidence: 0.6,
          evidence: "Low quality",
        },
      ];

      const tier = orchestrator.getRecommendedTier(signals);

      expect(tier).toBe("simplified_prompt");
    });

    it("should default to format_guidance", () => {
      const tier = orchestrator.getRecommendedTier([]);

      expect(tier).toBe("format_guidance");
    });

    it("should use and clear nextRecommendedStrategy", () => {
      orchestrator.setNextStrategy("context_reset");

      const tier1 = orchestrator.getRecommendedTier([]);
      expect(tier1).toBe("context_reset");

      // Should be cleared after use
      const tier2 = orchestrator.getRecommendedTier([]);
      expect(tier2).toBe("format_guidance");
    });
  });

  describe("setNextStrategy()", () => {
    it("should set recommended strategy", () => {
      orchestrator.setNextStrategy("simplified_prompt");

      const tier = orchestrator.getRecommendedTier([]);

      expect(tier).toBe("simplified_prompt");
    });
  });

  describe("Tier Progression", () => {
    it("should progress through tiers: guidance -> simplified -> reset -> manual", async () => {
      // Mock all strategies to fail except manual
      for (const tier of [
        "format_guidance",
        "simplified_prompt",
        "context_reset",
      ]) {
        const mockStrategy = {
          tier: tier as RecoveryTier,
          execute: vi.fn().mockResolvedValue({
            success: false,
            tier,
            message: "Failed",
          }),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (orchestrator as any).strategies.set(tier, mockStrategy);
      }

      const context: RecoveryContext = {
        tier: "format_guidance",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: [],
        signals: [],
      };

      const result = await orchestrator.attemptRecovery(
        context,
        {
          taskDescription: "Test",
          planContent: "Plan",
          workingDir: "/test",
        },
        mockClient,
      );

      // Should end at manual_fallback
      expect(result.tier).toBe("manual_fallback");
    });
  });
});
