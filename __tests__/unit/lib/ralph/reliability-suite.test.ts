/**
 * Integration tests for Ralph Loop Reliability Features
 * Tests complete workflows with all modules working together
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StuckDetector } from "@/lib/ralph/stuck-detector";
import { RecoveryOrchestrator } from "@/lib/ralph/recovery-strategies";
import { CompletionValidator } from "@/lib/ralph/completion-validator";
import { TestGate, type TestRunResult } from "@/lib/ralph/test-gate";
import { smartExtractFiles } from "@/lib/ralph/smart-extractor";
import type { AIClient } from "@/lib/ai/client";
import { writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

// Mock AI Client
const createMockAIClient = (
  responses: Record<string, string> = {},
): AIClient => {
  const defaultResponses = {
    default: "src/main.ts",
    validation: JSON.stringify({
      valid: true,
      reasoning: "Implementation looks good",
    }),
    recovery: "Simplified prompt response",
    extraction: JSON.stringify([
      {
        path: "src/main.ts",
        action: "modify",
        content: "export function main() { return 'fixed'; }",
      },
    ]),
    ...responses,
  };

  return {
    chat: vi.fn().mockImplementation((messages) => {
      const prompt = messages[0]?.content || "";
      if (prompt.includes("validation"))
        return Promise.resolve(defaultResponses.validation);
      if (prompt.includes("recovery"))
        return Promise.resolve(defaultResponses.recovery);
      if (prompt.includes("extraction") || prompt.includes("file changes"))
        return Promise.resolve(defaultResponses.extraction);
      return Promise.resolve(defaultResponses.default);
    }),
    getProvider: () => "anthropic",
    getModel: () => "claude-sonnet-4",
  } as unknown as AIClient;
};

describe("Integration: Stuck Detection → Recovery", () => {
  let detector: StuckDetector;
  let orchestrator: RecoveryOrchestrator;
  let mockClient: AIClient;

  beforeEach(() => {
    detector = new StuckDetector({
      maxConsecutiveErrors: 3,
      iterationTimeoutMinutes: 10,
      progressCommitThreshold: 3,
    });
    orchestrator = new RecoveryOrchestrator();
    mockClient = createMockAIClient();
  });

  it("should trigger recovery when stuck signals detected", async () => {
    // Simulate 3 consecutive errors
    for (let i = 1; i <= 3; i++) {
      detector.analyze({
        iteration: i,
        error: `Error ${i}`,
        commits: 0,
        extractionSuccess: false,
      });
    }

    const signals = detector.analyze({
      iteration: 4,
      error: "Error 4",
      commits: 0,
      extractionSuccess: false,
    });

    expect(detector.isStuck(signals)).toBe(true);

    // Attempt recovery
    const tier = orchestrator.getRecommendedTier(signals);
    expect(tier).toBe("format_guidance"); // Default for consecutive errors

    const recoveryResult = await orchestrator.attemptRecovery(
      {
        tier,
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: ["Error 1", "Error 2", "Error 3", "Error 4"],
        signals,
      },
      {
        taskDescription: "Fix bug",
        planContent: "Fix the authentication bug",
        workingDir: "/test",
      },
      mockClient,
    );

    expect(recoveryResult.success).toBe(true);
    expect(recoveryResult.modifiedContext).toBeDefined();
  });

  it("should escalate recovery tiers on repeated failures", async () => {
    // Simulate repeated pattern
    for (let i = 1; i <= 3; i++) {
      detector.analyze({
        iteration: i,
        output: "Same output repeated",
        commits: 0,
        extractionSuccess: false,
      });
    }

    const signals = detector.analyze({
      iteration: 4,
      output: "Same output repeated",
      commits: 0,
      extractionSuccess: false,
    });

    const patternSignal = signals.find((s) => s.type === "repeated_pattern");
    expect(patternSignal).toBeDefined();

    // Recovery should recommend context reset for patterns
    const tier = orchestrator.getRecommendedTier(signals);
    expect(tier).toBe("context_reset");
  });

  it("should generate report with recovery recommendations", () => {
    // Need 3 consecutive errors to trigger consecutive_errors signal
    detector.analyze({
      iteration: 1,
      error: "Fatal error",
      commits: 0,
      extractionSuccess: false,
    });
    detector.analyze({
      iteration: 2,
      error: "Fatal error",
      commits: 0,
      extractionSuccess: false,
    });
    const signals = detector.analyze({
      iteration: 3,
      error: "Fatal error",
      commits: 0,
      extractionSuccess: false,
    });

    const report = detector.generateReport(signals);

    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]).toContain("simplified prompts");
  });
});

describe("Integration: Recovery → Enhanced Extraction", () => {
  let orchestrator: RecoveryOrchestrator;
  let mockClient: AIClient;

  beforeEach(() => {
    orchestrator = new RecoveryOrchestrator();
    mockClient = createMockAIClient({
      extraction: JSON.stringify([
        {
          path: "src/main.ts",
          action: "modify",
          content: "export function main() { return 'fixed'; }",
        },
      ]),
    });
  });

  it("should use single-file strategy after simplified_prompt recovery", async () => {
    const recoveryResult = await orchestrator.attemptRecovery(
      {
        tier: "simplified_prompt",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: [],
        signals: [],
      },
      {
        taskDescription: "Fix main function",
        planContent: "Update main.ts",
        workingDir: "/test",
      },
      mockClient,
    );

    expect(recoveryResult.success).toBe(true);
    expect(recoveryResult.modifiedContext?.focusFiles).toBeDefined();

    // Use recommended strategy for extraction
    const extraction = await smartExtractFiles(
      "Some output without clear format",
      {
        client: mockClient,
        strategy: "ai-single-file",
        focusFiles: recoveryResult.modifiedContext?.focusFiles,
      },
    );

    expect(extraction.method).toBe("ai-single-file");
  });

  it("should provide retry recommendations from extraction", async () => {
    const extraction = await smartExtractFiles("No files found here", {
      client: mockClient,
      previousAttempts: 1,
    });

    expect(extraction.shouldRetry).toBeDefined();
    if (extraction.shouldRetry) {
      expect(extraction.recommendedStrategy).toBeDefined();
    }
  });
});

describe("Integration: Completion Validation → Test Gate", () => {
  let validator: CompletionValidator;
  let testGate: TestGate;
  let testDir: string;

  beforeEach(() => {
    validator = new CompletionValidator();
    testGate = new TestGate({
      policy: "strict",
      criticalTestPatterns: ["auth", "payment"],
      requireAllPassing: false,
      allowedFailureRate: 0,
    });

    // Create temp repo
    testDir = join(tmpdir(), `integration-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    execSync("git init", { cwd: testDir });
    execSync('git config user.email "test@test.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });

    writeFileSync(join(testDir, "README.md"), "# Test");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Initial"', { cwd: testDir });
  });

  it("should pass validation and test gate for successful completion", async () => {
    // Create and commit files
    mkdirSync(join(testDir, "src"), { recursive: true });
    writeFileSync(join(testDir, "src/main.ts"), "export const main = 1;");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Add main"', { cwd: testDir });

    const commits = [
      execSync("git rev-parse HEAD", {
        cwd: testDir,
        encoding: "utf-8",
      }).trim(),
    ];

    // Validate completion
    const validation = await validator.validate({
      output: "All done. RALPH_COMPLETE",
      commits,
      plan: "Add src/main.ts file",
      workingDir: testDir,
    });

    expect(validation.passed).toBe(true);
    expect(validation.score).toBeGreaterThanOrEqual(80);

    // Run test gate
    const testResult: TestRunResult = {
      passed: 10,
      failed: 0,
      skipped: 0,
      total: 10,
      failures: [],
    };

    const gateDecision = testGate.analyze(testResult);

    expect(gateDecision.shouldBlock).toBe(false);
  });

  it("should fail validation OR test gate when quality issues exist", async () => {
    // Scenario 1: Validation fails (no commits)
    const validation1 = await validator.validate({
      output: "RALPH_COMPLETE",
      commits: [],
      plan: "Do something",
      workingDir: testDir,
    });

    expect(validation1.passed).toBe(false);

    // Scenario 2: Test gate fails (critical test failure)
    const testResult: TestRunResult = {
      passed: 9,
      failed: 1,
      skipped: 0,
      total: 10,
      failures: [{ testName: "Auth login test" }],
    };

    const gateDecision = testGate.analyze(testResult);

    expect(gateDecision.shouldBlock).toBe(true);
    expect(gateDecision.reason).toContain("critical");
  });

  it("should allow completion with warnings under warn policy", async () => {
    const warnGate = new TestGate({
      policy: "warn",
      criticalTestPatterns: [],
      requireAllPassing: false,
      allowedFailureRate: 0,
    });

    const testResult: TestRunResult = {
      passed: 8,
      failed: 2,
      skipped: 0,
      total: 10,
      failures: [{ testName: "UI test" }, { testName: "Style test" }],
    };

    const gateDecision = warnGate.analyze(testResult);

    expect(gateDecision.shouldBlock).toBe(false);
    expect(gateDecision.warnings).toBeDefined();
    expect(gateDecision.warnings!.length).toBeGreaterThan(0);
  });
});

describe("Integration: Full Reliability Pipeline", () => {
  let detector: StuckDetector;
  let orchestrator: RecoveryOrchestrator;
  let validator: CompletionValidator;
  let testGate: TestGate;
  let mockClient: AIClient;
  let testDir: string;

  beforeEach(() => {
    detector = new StuckDetector();
    orchestrator = new RecoveryOrchestrator();
    validator = new CompletionValidator();
    testGate = new TestGate({
      policy: "strict",
      criticalTestPatterns: ["auth"],
    });
    mockClient = createMockAIClient();

    testDir = join(tmpdir(), `full-pipeline-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    execSync("git init", { cwd: testDir });
    execSync('git config user.email "test@test.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });

    writeFileSync(join(testDir, "README.md"), "# Test");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Initial"', { cwd: testDir });
  });

  it("should handle complete successful flow", async () => {
    // Step 1: No stuck signals (healthy iteration)
    const signals = detector.analyze({
      iteration: 1,
      commits: 1,
      extractionSuccess: true,
    });

    expect(detector.isStuck(signals)).toBe(false);

    // Step 2: Create commit
    writeFileSync(join(testDir, "main.ts"), "export const x = 1;");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Add main"', { cwd: testDir });

    const commits = [
      execSync("git rev-parse HEAD", {
        cwd: testDir,
        encoding: "utf-8",
      }).trim(),
    ];

    // Step 3: Validate completion
    const validation = await validator.validate({
      output: "RALPH_COMPLETE",
      commits,
      plan: "Add main.ts",
      workingDir: testDir,
    });

    expect(validation.passed).toBe(true);

    // Step 4: Test gate passes
    const testResult: TestRunResult = {
      passed: 10,
      failed: 0,
      skipped: 0,
      total: 10,
      failures: [],
    };

    const gateDecision = testGate.analyze(testResult);

    expect(gateDecision.shouldBlock).toBe(false);

    // Complete success!
  });

  it("should handle recovery from stuck state to successful completion", async () => {
    // Step 1: Trigger stuck state
    for (let i = 1; i <= 3; i++) {
      detector.analyze({
        iteration: i,
        error: `Error ${i}`,
        commits: 0,
        extractionSuccess: false,
      });
    }

    const signals = detector.analyze({
      iteration: 4,
      error: "Error 4",
      commits: 0,
      extractionSuccess: false,
    });

    expect(detector.isStuck(signals)).toBe(true);

    // Step 2: Attempt recovery
    const tier = orchestrator.getRecommendedTier(signals);
    const recoveryResult = await orchestrator.attemptRecovery(
      {
        tier,
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: ["Error 1", "Error 2", "Error 3", "Error 4"],
        signals,
      },
      {
        taskDescription: "Fix issue",
        planContent: "Fix the bug",
        workingDir: testDir,
      },
      mockClient,
    );

    expect(recoveryResult.success).toBe(true);

    // Step 3: After recovery, simulate success
    detector.reset(); // Reset stuck state

    writeFileSync(join(testDir, "fixed.ts"), "export const fixed = true;");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Fix applied"', { cwd: testDir });

    const commits = [
      execSync("git rev-parse HEAD", {
        cwd: testDir,
        encoding: "utf-8",
      }).trim(),
    ];

    const validation = await validator.validate({
      output: "RALPH_COMPLETE",
      commits,
      plan: "Fix the bug in fixed.ts",
      workingDir: testDir,
    });

    expect(validation.passed).toBe(true);
  });

  it("should block when test gate detects critical failures", async () => {
    // Successful completion
    writeFileSync(join(testDir, "auth.ts"), "export const auth = true;");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Add auth"', { cwd: testDir });

    const commits = [
      execSync("git rev-parse HEAD", {
        cwd: testDir,
        encoding: "utf-8",
      }).trim(),
    ];

    const validation = await validator.validate({
      output: "RALPH_COMPLETE",
      commits,
      plan: "Add auth.ts",
      workingDir: testDir,
    });

    expect(validation.passed).toBe(true);

    // But test gate blocks due to critical failure
    const testResult: TestRunResult = {
      passed: 9,
      failed: 1,
      skipped: 0,
      total: 10,
      failures: [{ testName: "Auth security test" }],
    };

    const gateDecision = testGate.analyze(testResult);

    expect(gateDecision.shouldBlock).toBe(true);
    expect(gateDecision.reason).toContain("critical");

    // Task should go to review, not done
  });

  it("should reach manual fallback when all recovery tiers fail", async () => {
    // Trigger stuck state
    for (let i = 1; i <= 3; i++) {
      detector.analyze({
        iteration: i,
        error: `Persistent error ${i}`,
        commits: 0,
        extractionSuccess: false,
      });
    }

    const signals = detector.analyze({
      iteration: 4,
      error: "Persistent error 4",
      commits: 0,
      extractionSuccess: false,
    });

    expect(detector.isStuck(signals)).toBe(true);

    // Mock all tiers to fail
    for (const tier of [
      "format_guidance",
      "simplified_prompt",
      "context_reset",
    ] as const) {
      const mockStrategy = {
        tier: tier,
        execute: vi.fn().mockResolvedValue({
          success: false,
          tier,
          message: "Failed",
        }),
      };
      orchestrator.__test_setStrategy(tier, mockStrategy);
    }

    // Attempt recovery - should escalate to manual fallback
    const recoveryResult = await orchestrator.attemptRecovery(
      {
        tier: "format_guidance",
        attemptNumber: 1,
        maxAttempts: 4,
        previousErrors: ["Error 1", "Error 2"],
        signals,
      },
      {
        taskDescription: "Impossible task",
        planContent: "Cannot be completed",
        workingDir: testDir,
      },
      mockClient,
    );

    expect(recoveryResult.tier).toBe("manual_fallback");
    expect(recoveryResult.success).toBe(false);
    expect(recoveryResult.manualSteps).toBeDefined();
    expect(recoveryResult.manualSteps!.length).toBeGreaterThan(0);
  });
});

describe("Integration: Confidence Scoring Flow", () => {
  it("should use confidence scores to recommend strategies", async () => {
    const mockClient = createMockAIClient();

    // Try extraction with low confidence
    const extraction1 = await smartExtractFiles("Ambiguous output", {
      client: mockClient,
      previousAttempts: 1,
    });

    expect(extraction1.confidence).toBeDefined();

    // If confidence is low and shouldRetry is true, use recommended strategy
    if (extraction1.shouldRetry && extraction1.recommendedStrategy) {
      const extraction2 = await smartExtractFiles("Ambiguous output", {
        client: mockClient,
        strategy: extraction1.recommendedStrategy,
        previousAttempts: 2,
      });

      expect(extraction2.method).toBe(extraction1.recommendedStrategy);
    }
  });
});
