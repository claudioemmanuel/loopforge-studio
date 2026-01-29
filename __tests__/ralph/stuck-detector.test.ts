/**
 * Unit tests for StuckDetector
 * Target coverage: 90%+
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  StuckDetector,
  LegacyStuckChecker,
  type StuckSignal,
} from "@/lib/ralph/stuck-detector";

describe("StuckDetector", () => {
  let detector: StuckDetector;

  beforeEach(() => {
    detector = new StuckDetector({
      maxConsecutiveErrors: 3,
      iterationTimeoutMinutes: 10,
      progressCommitThreshold: 3,
      patternRepetitionThreshold: 2,
      qualityDegradationWindow: 5,
      qualityDegradationThreshold: 0.4,
    });
  });

  describe("Signal 1: Consecutive Errors", () => {
    it("should detect consecutive errors at threshold", () => {
      // Trigger 3 consecutive errors
      for (let i = 1; i <= 3; i++) {
        const signals = detector.analyze({
          iteration: i,
          error: `Error ${i}`,
          commits: 0,
          extractionSuccess: false,
        });

        if (i === 3) {
          // At iteration 3, we get both consecutive_errors AND no_progress signals
          expect(signals.length).toBeGreaterThanOrEqual(1);
          const errorSignal = signals.find(
            (s) => s.type === "consecutive_errors",
          );
          expect(errorSignal).toBeDefined();
          expect(errorSignal!.severity).toBe("high");
          expect(errorSignal!.confidence).toBeGreaterThanOrEqual(0.8);
        }
      }
    });

    it("should reset counter on success", () => {
      detector.analyze({
        iteration: 1,
        error: "Error 1",
        commits: 0,
        extractionSuccess: false,
      });

      detector.analyze({
        iteration: 2,
        error: "Error 2",
        commits: 0,
        extractionSuccess: false,
      });

      // Success - should reset
      detector.analyze({
        iteration: 3,
        commits: 1,
        extractionSuccess: true,
      });

      const signals = detector.analyze({
        iteration: 4,
        error: "Error 3",
        commits: 0,
        extractionSuccess: false,
      });

      // Should not have consecutive error signal (counter reset)
      expect(
        signals.find((s) => s.type === "consecutive_errors"),
      ).toBeUndefined();
    });

    it("should increase confidence with more errors", () => {
      for (let i = 1; i <= 5; i++) {
        detector.analyze({
          iteration: i,
          error: `Error ${i}`,
          commits: 0,
          extractionSuccess: false,
        });
      }

      const signals = detector.analyze({
        iteration: 6,
        error: "Error 6",
        commits: 0,
        extractionSuccess: false,
      });

      const errorSignal = signals.find((s) => s.type === "consecutive_errors");
      expect(errorSignal).toBeDefined();
      expect(errorSignal!.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("Signal 2: Repeated Patterns", () => {
    it("should detect repeated similar output", () => {
      const repeatedOutput = "This is the same output repeated";

      // First iteration
      detector.analyze({
        iteration: 1,
        output: repeatedOutput,
        commits: 0,
        extractionSuccess: false,
      });

      // Second iteration - same output
      detector.analyze({
        iteration: 2,
        output: repeatedOutput,
        commits: 0,
        extractionSuccess: false,
      });

      // Third iteration - same output (should trigger)
      const signals = detector.analyze({
        iteration: 3,
        output: repeatedOutput,
        commits: 0,
        extractionSuccess: false,
      });

      const patternSignal = signals.find((s) => s.type === "repeated_pattern");
      expect(patternSignal).toBeDefined();
      expect(patternSignal!.severity).toBe("medium");
    });

    it("should not detect when output varies", () => {
      detector.analyze({
        iteration: 1,
        output: "Output 1 is different",
        commits: 0,
        extractionSuccess: false,
      });

      detector.analyze({
        iteration: 2,
        output: "Output 2 has unique content",
        commits: 0,
        extractionSuccess: false,
      });

      const signals = detector.analyze({
        iteration: 3,
        output: "Output 3 is completely different",
        commits: 0,
        extractionSuccess: false,
      });

      expect(
        signals.find((s) => s.type === "repeated_pattern"),
      ).toBeUndefined();
    });
  });

  describe("Signal 3: Iteration Timeout", () => {
    it("should detect timeout when iteration takes too long", () => {
      const now = new Date();
      const elevenMinutesAgo = new Date(now.getTime() - 11 * 60 * 1000);

      detector.analyze({
        iteration: 1,
        commits: 0,
        extractionSuccess: false,
        timestamp: elevenMinutesAgo,
      });

      const signals = detector.analyze({
        iteration: 2,
        commits: 0,
        extractionSuccess: false,
        timestamp: now,
      });

      const timeoutSignal = signals.find((s) => s.type === "iteration_timeout");
      expect(timeoutSignal).toBeDefined();
      expect(timeoutSignal!.severity).toBe("critical");
      expect(timeoutSignal!.confidence).toBe(1.0);
    });

    it("should not detect timeout within limit", () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      detector.analyze({
        iteration: 1,
        commits: 0,
        extractionSuccess: false,
        timestamp: fiveMinutesAgo,
      });

      const signals = detector.analyze({
        iteration: 2,
        commits: 0,
        extractionSuccess: false,
        timestamp: now,
      });

      expect(
        signals.find((s) => s.type === "iteration_timeout"),
      ).toBeUndefined();
    });
  });

  describe("Signal 4: Quality Degradation", () => {
    it("should detect quality degradation", () => {
      // 5 iterations with poor extraction success
      for (let i = 1; i <= 5; i++) {
        detector.analyze({
          iteration: i,
          commits: 0,
          extractionSuccess: i === 1, // Only first succeeds (20% success rate)
        });
      }

      const signals = detector.analyze({
        iteration: 6,
        commits: 0,
        extractionSuccess: false,
      });

      const qualitySignal = signals.find(
        (s) => s.type === "quality_degradation",
      );
      expect(qualitySignal).toBeDefined();
      expect(qualitySignal!.severity).toBe("medium");
    });

    it("should not detect when quality is good", () => {
      // 5 iterations with good extraction success
      for (let i = 1; i <= 5; i++) {
        detector.analyze({
          iteration: i,
          commits: 1,
          extractionSuccess: true, // All succeed (100% success rate)
        });
      }

      const signals = detector.analyze({
        iteration: 6,
        commits: 1,
        extractionSuccess: true,
      });

      expect(
        signals.find((s) => s.type === "quality_degradation"),
      ).toBeUndefined();
    });
  });

  describe("Signal 5: No Progress", () => {
    it("should detect no progress after threshold iterations", () => {
      // 3 iterations without commits
      for (let i = 1; i <= 3; i++) {
        const signals = detector.analyze({
          iteration: i,
          commits: 0,
          extractionSuccess: false,
        });

        if (i === 3) {
          const progressSignal = signals.find((s) => s.type === "no_progress");
          expect(progressSignal).toBeDefined();
          expect(progressSignal!.severity).toBe("high");
        }
      }
    });

    it("should reset counter when commits are made", () => {
      detector.analyze({
        iteration: 1,
        commits: 0,
        extractionSuccess: false,
      });

      detector.analyze({
        iteration: 2,
        commits: 0,
        extractionSuccess: false,
      });

      // Make a commit
      detector.analyze({
        iteration: 3,
        commits: 1,
        extractionSuccess: true,
      });

      const signals = detector.analyze({
        iteration: 4,
        commits: 0,
        extractionSuccess: false,
      });

      // Counter should be reset, no progress signal yet
      expect(signals.find((s) => s.type === "no_progress")).toBeUndefined();
    });
  });

  describe("isStuck()", () => {
    it("should return true for critical severity", () => {
      const signals: StuckSignal[] = [
        {
          type: "iteration_timeout",
          severity: "critical",
          confidence: 1.0,
          evidence: "Timeout",
        },
      ];

      expect(detector.isStuck(signals)).toBe(true);
    });

    it("should return true for 2+ high severity", () => {
      const signals: StuckSignal[] = [
        {
          type: "consecutive_errors",
          severity: "high",
          confidence: 0.9,
          evidence: "Errors",
        },
        {
          type: "no_progress",
          severity: "high",
          confidence: 0.75,
          evidence: "No commits",
        },
      ];

      expect(detector.isStuck(signals)).toBe(true);
    });

    it("should return true for 3+ medium severity", () => {
      const signals: StuckSignal[] = [
        {
          type: "repeated_pattern",
          severity: "medium",
          confidence: 0.7,
          evidence: "Repetition",
        },
        {
          type: "quality_degradation",
          severity: "medium",
          confidence: 0.6,
          evidence: "Quality",
        },
        {
          type: "repeated_pattern",
          severity: "medium",
          confidence: 0.7,
          evidence: "Repetition 2",
        },
      ];

      expect(detector.isStuck(signals)).toBe(true);
    });

    it("should return true for single high confidence high severity", () => {
      const signals: StuckSignal[] = [
        {
          type: "consecutive_errors",
          severity: "high",
          confidence: 0.95,
          evidence: "Many errors",
        },
      ];

      expect(detector.isStuck(signals)).toBe(true);
    });

    it("should return false for low severity signals", () => {
      const signals: StuckSignal[] = [
        {
          type: "repeated_pattern",
          severity: "medium",
          confidence: 0.5,
          evidence: "Some repetition",
        },
      ];

      expect(detector.isStuck(signals)).toBe(false);
    });

    it("should return false for empty signals", () => {
      expect(detector.isStuck([])).toBe(false);
    });
  });

  describe("generateReport()", () => {
    it("should generate report with stuck status", () => {
      const signals: StuckSignal[] = [
        {
          type: "consecutive_errors",
          severity: "high",
          confidence: 0.9,
          evidence: "3 consecutive errors",
        },
      ];

      const report = detector.generateReport(signals);

      expect(report.isStuck).toBe(true);
      expect(report.confidence).toBeGreaterThan(0);
      expect(report.summary).toContain("stuck");
      expect(report.signals).toEqual(signals);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it("should include recommendations based on signal types", () => {
      const signals: StuckSignal[] = [
        {
          type: "repeated_pattern",
          severity: "medium",
          confidence: 0.7,
          evidence: "Repetition",
        },
      ];

      const report = detector.generateReport(signals);

      expect(report.recommendations).toContain(
        "Reset conversation context to break repetition cycle",
      );
    });
  });

  describe("reset()", () => {
    it("should reset all internal state", () => {
      // Build up some state
      for (let i = 1; i <= 3; i++) {
        detector.analyze({
          iteration: i,
          error: `Error ${i}`,
          commits: 0,
          extractionSuccess: false,
        });
      }

      detector.reset();

      // Next error shouldn't trigger stuck (counter reset)
      const signals = detector.analyze({
        iteration: 1,
        error: "Error 1",
        commits: 0,
        extractionSuccess: false,
      });

      expect(
        signals.find((s) => s.type === "consecutive_errors"),
      ).toBeUndefined();
    });
  });
});

describe("LegacyStuckChecker", () => {
  let checker: LegacyStuckChecker;

  beforeEach(() => {
    checker = new LegacyStuckChecker(3);
  });

  it("should detect stuck after threshold errors", () => {
    checker.analyze({ error: "Error 1" });
    checker.analyze({ error: "Error 2" });
    const signals = checker.analyze({ error: "Error 3" });

    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe("consecutive_errors");
    expect(checker.isStuck(signals)).toBe(true);
  });

  it("should reset counter on success", () => {
    checker.analyze({ error: "Error 1" });
    checker.analyze({ error: "Error 2" });
    checker.analyze({}); // Success

    const signals = checker.analyze({ error: "Error 3" });

    expect(signals).toHaveLength(0);
    expect(checker.isStuck(signals)).toBe(false);
  });

  it("should generate simple report", () => {
    const signals = [
      {
        type: "consecutive_errors" as const,
        severity: "high" as const,
        confidence: 1.0,
        evidence: "3 consecutive errors (legacy checker)",
      },
    ];

    const report = checker.generateReport(signals);

    expect(report.isStuck).toBe(true);
    expect(report.confidence).toBe(1.0);
    expect(report.recommendations).toContain("Manual intervention required");
  });
});
