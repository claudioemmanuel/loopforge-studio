import { describe, expect, it } from "vitest";
import {
  ContextResetStrategy,
  FormatGuidanceStrategy,
} from "@/lib/ralph/recovery-strategies";

describe("recovery-strategies", () => {
  it("format guidance strategy returns strict formatting instructions", async () => {
    const strategy = new FormatGuidanceStrategy();
    const result = await strategy.execute(
      {
        tier: "format_guidance",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: ["bad format"],
        signals: [],
      },
      {
        taskDescription: "Update file",
        planContent: "Step 1",
        workingDir: "/tmp",
      },
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("format_guidance");
    expect(result.modifiedContext?.systemPrompt).toContain("FILE:");
  });

  it("context reset strategy clears history context", async () => {
    const strategy = new ContextResetStrategy();
    const result = await strategy.execute(
      {
        tier: "context_reset",
        attemptNumber: 3,
        maxAttempts: 4,
        previousErrors: ["loop"],
        signals: [],
      },
      {
        taskDescription: "Fix flaky tests",
        planContent: "1. Inspect logs\n2. Patch",
        workingDir: "/tmp",
      },
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("context_reset");
    expect(result.modifiedContext?.conversationHistory).toEqual([]);
  });
});
