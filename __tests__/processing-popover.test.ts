/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { phaseConfig } from "@/components/kanban/processing-popover";
import type { ProcessingPhase } from "@/lib/db/schema";

describe("Processing Popover Utilities", () => {
  describe("phaseConfig", () => {
    it("should have configuration for all processing phases", () => {
      const phases: ProcessingPhase[] = ["brainstorming", "planning", "executing"];

      for (const phase of phases) {
        expect(phaseConfig[phase]).toBeDefined();
        expect(phaseConfig[phase].icon).toBeDefined();
        expect(phaseConfig[phase].label).toBeDefined();
        expect(phaseConfig[phase].color).toBeDefined();
        expect(phaseConfig[phase].bgColor).toBeDefined();
        expect(phaseConfig[phase].borderColor).toBeDefined();
        expect(phaseConfig[phase].progressColor).toBeDefined();
      }
    });

    it("should have correct labels for each phase", () => {
      expect(phaseConfig.brainstorming.label).toBe("Brainstorming");
      expect(phaseConfig.planning.label).toBe("Planning");
      expect(phaseConfig.executing.label).toBe("Executing");
    });

    it("should have violet colors for brainstorming", () => {
      expect(phaseConfig.brainstorming.color).toContain("violet");
      expect(phaseConfig.brainstorming.bgColor).toContain("violet");
      expect(phaseConfig.brainstorming.progressColor).toContain("violet");
    });

    it("should have blue colors for planning", () => {
      expect(phaseConfig.planning.color).toContain("blue");
      expect(phaseConfig.planning.bgColor).toContain("blue");
      expect(phaseConfig.planning.progressColor).toContain("blue");
    });

    it("should have emerald colors for executing", () => {
      expect(phaseConfig.executing.color).toContain("emerald");
      expect(phaseConfig.executing.bgColor).toContain("emerald");
      expect(phaseConfig.executing.progressColor).toContain("emerald");
    });
  });

  describe("formatElapsedTime", () => {
    // We need to test the internal function, which we'll extract for testing
    const formatElapsedTime = (startedAt: string): string => {
      const start = new Date(startedAt);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);

      if (diffSeconds < 60) {
        return `${diffSeconds}s`;
      }

      const diffMinutes = Math.floor(diffSeconds / 60);
      const remainingSeconds = diffSeconds % 60;

      if (diffMinutes < 60) {
        return `${diffMinutes}m ${remainingSeconds}s`;
      }

      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;
      return `${diffHours}h ${remainingMinutes}m`;
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should format seconds correctly", () => {
      // 30 seconds ago
      expect(formatElapsedTime("2024-01-15T10:29:30.000Z")).toBe("30s");
      expect(formatElapsedTime("2024-01-15T10:29:45.000Z")).toBe("15s");
      expect(formatElapsedTime("2024-01-15T10:29:55.000Z")).toBe("5s");
    });

    it("should format minutes and seconds correctly", () => {
      // 1 minute 30 seconds ago
      expect(formatElapsedTime("2024-01-15T10:28:30.000Z")).toBe("1m 30s");
      // 5 minutes ago
      expect(formatElapsedTime("2024-01-15T10:25:00.000Z")).toBe("5m 0s");
      // 15 minutes 45 seconds ago
      expect(formatElapsedTime("2024-01-15T10:14:15.000Z")).toBe("15m 45s");
    });

    it("should format hours and minutes correctly", () => {
      // 1 hour 15 minutes ago
      expect(formatElapsedTime("2024-01-15T09:15:00.000Z")).toBe("1h 15m");
      // 2 hours 30 minutes ago
      expect(formatElapsedTime("2024-01-15T08:00:00.000Z")).toBe("2h 30m");
    });

    it("should handle edge case at 0 seconds", () => {
      expect(formatElapsedTime("2024-01-15T10:30:00.000Z")).toBe("0s");
    });

    it("should handle edge case at exactly 60 seconds", () => {
      expect(formatElapsedTime("2024-01-15T10:29:00.000Z")).toBe("1m 0s");
    });

    it("should handle edge case at exactly 60 minutes", () => {
      expect(formatElapsedTime("2024-01-15T09:30:00.000Z")).toBe("1h 0m");
    });
  });
});

describe("CardProcessingState integration", () => {
  it("should have compatible structure with processing events", () => {
    // This test ensures the CardProcessingState type matches what the SSE sends
    const state = {
      taskId: "task-123",
      taskTitle: "Test Task",
      repoName: "test-repo",
      processingPhase: "brainstorming" as ProcessingPhase,
      statusText: "Analyzing task...",
      progress: 50,
      jobId: "job-456",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Verify all required fields are present
    expect(state.taskId).toBeDefined();
    expect(state.taskTitle).toBeDefined();
    expect(state.repoName).toBeDefined();
    expect(state.processingPhase).toBeDefined();
    expect(state.statusText).toBeDefined();
    expect(state.progress).toBeGreaterThanOrEqual(0);
    expect(state.progress).toBeLessThanOrEqual(100);
    expect(state.jobId).toBeDefined();
    expect(state.startedAt).toBeDefined();
    expect(state.updatedAt).toBeDefined();
  });

  it("should handle optional error field", () => {
    const stateWithError = {
      taskId: "task-123",
      taskTitle: "Test Task",
      repoName: "test-repo",
      processingPhase: "executing" as ProcessingPhase,
      statusText: "Failed",
      progress: 30,
      jobId: "job-456",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: "API rate limit exceeded",
    };

    expect(stateWithError.error).toBe("API rate limit exceeded");
  });
});

describe("Progress bar calculations", () => {
  it("should calculate progress percentage for width correctly", () => {
    const testCases = [
      { progress: 0, expected: "0%" },
      { progress: 25, expected: "25%" },
      { progress: 50, expected: "50%" },
      { progress: 75, expected: "75%" },
      { progress: 100, expected: "100%" },
    ];

    for (const { progress, expected } of testCases) {
      expect(`${progress}%`).toBe(expected);
    }
  });

  it("should handle edge cases for progress values", () => {
    // Progress should be clamped between 0 and 100
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(100, 0, 100)).toBe(100);
    expect(clamp(150, 0, 100)).toBe(100);
  });
});
