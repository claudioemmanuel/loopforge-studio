/**
 * Unit tests for CompletionValidator
 * Target coverage: 90%+
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CompletionValidator,
  LegacyCompletionChecker,
} from "@/lib/ralph/completion-validator";
import type { AIClient } from "@/lib/ai/client";
import { writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

describe("CompletionValidator", () => {
  let validator: CompletionValidator;
  let testDir: string;

  beforeEach(() => {
    validator = new CompletionValidator();

    // Create temp directory for test repo
    testDir = join(tmpdir(), `completion-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Initialize git repo
    execSync("git init", { cwd: testDir });
    execSync('git config user.email "test@test.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });

    // Create initial commit
    writeFileSync(join(testDir, "README.md"), "# Test");
    execSync("git add .", { cwd: testDir });
    execSync('git commit -m "Initial commit"', { cwd: testDir });
  });

  describe("Check 1: hasMarker", () => {
    it("should pass when RALPH_COMPLETE is present", async () => {
      const validation = await validator.validate({
        output: "Code changes complete. RALPH_COMPLETE",
        commits: ["abc123"],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.hasMarker).toBe(true);
    });

    it("should fail when RALPH_COMPLETE is missing", async () => {
      const validation = await validator.validate({
        output: "Code changes complete.",
        commits: ["abc123"],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.hasMarker).toBe(false);
      expect(validation.failures).toContain("Missing RALPH_COMPLETE marker");
    });
  });

  describe("Check 2: hasCommits", () => {
    it("should pass when commits exist", async () => {
      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits: ["abc123"],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.hasCommits).toBe(true);
    });

    it("should fail when no commits", async () => {
      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits: [],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.hasCommits).toBe(false);
      expect(validation.failures).toContain("No commits made");
    });
  });

  describe("Check 3: matchesPlan", () => {
    it("should pass with good plan coverage", async () => {
      // Create and commit test files
      writeFileSync(join(testDir, "src/app.ts"), "console.log('app');");
      writeFileSync(join(testDir, "src/utils.ts"), "export const util = 1;");
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add files"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const plan = `
## Implementation Plan

Modify the following files:
- \`src/app.ts\` - Main application entry
- \`src/utils.ts\` - Utility functions
`;

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan,
        workingDir: testDir,
      });

      expect(validation.checks.matchesPlan).toBe(true);
      expect(validation.metadata?.planCoverage).toBeGreaterThanOrEqual(0.5);
    });

    it("should fail with low plan coverage", async () => {
      // Commit unrelated files
      writeFileSync(join(testDir, "other.ts"), "console.log('other');");
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add other file"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const plan = `
## Implementation Plan

Modify:
- \`src/app.ts\` - Main application
- \`src/utils.ts\` - Utilities
- \`src/config.ts\` - Configuration
`;

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan,
        workingDir: testDir,
      });

      expect(validation.checks.matchesPlan).toBe(false);
      expect(validation.metadata?.planCoverage).toBeLessThan(0.5);
    });

    it("should pass when no plan provided", async () => {
      writeFileSync(join(testDir, "file.ts"), "code");
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add file"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.matchesPlan).toBe(true);
    });
  });

  describe("Check 4: qualityThreshold", () => {
    it("should pass for reasonable commit size", async () => {
      writeFileSync(
        join(testDir, "file.ts"),
        "// Reasonable amount of code\n".repeat(50),
      );
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add code"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.qualityThreshold).toBe(true);
    });

    it("should fail for empty commits", async () => {
      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits: ["abc123"], // Non-existent commit
        plan: "",
        workingDir: testDir,
      });

      // Should fail quality check for non-existent commit
      expect(validation.checks.qualityThreshold).toBe(false);
    });
  });

  describe("Check 5: noCriticalErrors", () => {
    it("should pass when no critical errors", async () => {
      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits: ["abc123"],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.noCriticalErrors).toBe(true);
    });

    it("should fail when critical errors present", async () => {
      const validation = await validator.validate({
        output: "CRITICAL_ERROR: Database connection failed. RALPH_COMPLETE",
        commits: ["abc123"],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.checks.noCriticalErrors).toBe(false);
      expect(validation.failures).toContain("Critical errors detected");
    });
  });

  describe("Score Calculation", () => {
    it("should score 100 for perfect validation", async () => {
      writeFileSync(join(testDir, "app.ts"), "code");
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add app"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan: "",
        workingDir: testDir,
      });

      expect(validation.score).toBe(100);
      expect(validation.passed).toBe(true);
    });

    it("should fail with score < 80", async () => {
      const validation = await validator.validate({
        output: "No marker, no commits",
        commits: [],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.score).toBeLessThan(80);
      expect(validation.passed).toBe(false);
      expect(validation.failures.length).toBeGreaterThan(0);
    });

    it("should provide recommendations for failures", async () => {
      const validation = await validator.validate({
        output: "Missing marker",
        commits: [],
        plan: "",
        workingDir: testDir,
      });

      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.recommendations[0]).toContain("RALPH_COMPLETE");
    });
  });

  describe("AI-Assisted Validation", () => {
    it("should use AI fallback for low coverage", async () => {
      const mockAIClient: Partial<AIClient> = {
        chat: vi.fn().mockResolvedValue(
          JSON.stringify({
            valid: true,
            reasoning: "Implementation addresses core requirements",
          }),
        ),
      };

      writeFileSync(join(testDir, "other.ts"), "code");
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add file"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const plan = `
Modify src/app.ts and src/utils.ts (not matched by commits)
`;

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan,
        workingDir: testDir,
        aiClient: mockAIClient as AIClient,
      });

      // AI said valid, so matchesPlan should pass
      expect(validation.checks.matchesPlan).toBe(true);
      expect(mockAIClient.chat).toHaveBeenCalled();
    });

    it("should handle AI validation failure gracefully", async () => {
      const mockAIClient: Partial<AIClient> = {
        chat: vi.fn().mockRejectedValue(new Error("AI error")),
      };

      writeFileSync(join(testDir, "file.ts"), "code");
      execSync("git add .", { cwd: testDir });
      execSync('git commit -m "Add file"', { cwd: testDir });

      const commits = [
        execSync("git rev-parse HEAD", {
          cwd: testDir,
          encoding: "utf-8",
        }).trim(),
      ];

      const validation = await validator.validate({
        output: "RALPH_COMPLETE",
        commits,
        plan: "Some plan with different files",
        workingDir: testDir,
        aiClient: mockAIClient as AIClient,
      });

      // Should assume valid on AI error
      expect(validation.checks.matchesPlan).toBe(true);
    });
  });
});

describe("LegacyCompletionChecker", () => {
  let checker: LegacyCompletionChecker;

  beforeEach(() => {
    checker = new LegacyCompletionChecker();
  });

  it("should pass with marker and commits", async () => {
    const validation = await checker.validate({
      output: "RALPH_COMPLETE",
      commits: ["abc123"],
    });

    expect(validation.passed).toBe(true);
    expect(validation.score).toBe(100);
    expect(validation.checks.hasMarker).toBe(true);
    expect(validation.checks.hasCommits).toBe(true);
  });

  it("should fail without marker", async () => {
    const validation = await checker.validate({
      output: "No marker",
      commits: ["abc123"],
    });

    expect(validation.passed).toBe(false);
    expect(validation.score).toBe(0);
    expect(validation.failures).toContain("Missing RALPH_COMPLETE");
  });

  it("should fail without commits", async () => {
    const validation = await checker.validate({
      output: "RALPH_COMPLETE",
      commits: [],
    });

    expect(validation.passed).toBe(false);
    expect(validation.score).toBe(0);
    expect(validation.failures).toContain("No commits");
  });

  it("should not check advanced validations", async () => {
    const validation = await checker.validate({
      output: "RALPH_COMPLETE",
      commits: ["abc123"],
    });

    // Legacy checker doesn't validate these
    expect(validation.checks.matchesPlan).toBe(true);
    expect(validation.checks.qualityThreshold).toBe(true);
    expect(validation.checks.testsExecuted).toBe(false);
  });
});
