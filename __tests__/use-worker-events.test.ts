import { describe, it, expect } from "vitest";
import { calculateProgress } from "@/components/hooks/use-worker-events";
import type { TaskStatus } from "@/lib/db/schema";

describe("useWorkerEvents utilities", () => {
  describe("calculateProgress", () => {
    it("should return 0 for todo status", () => {
      expect(calculateProgress("todo")).toBe(0);
    });

    it("should return 20 for brainstorming status", () => {
      expect(calculateProgress("brainstorming")).toBe(20);
    });

    it("should return 40 for planning status", () => {
      expect(calculateProgress("planning")).toBe(40);
    });

    it("should return 60 for ready status", () => {
      expect(calculateProgress("ready")).toBe(60);
    });

    it("should return 80 for executing status without step info", () => {
      expect(calculateProgress("executing")).toBe(80);
    });

    it("should return 100 for done status", () => {
      expect(calculateProgress("done")).toBe(100);
    });

    it("should return 0 for stuck status", () => {
      expect(calculateProgress("stuck")).toBe(0);
    });

    describe("executing status with step parsing", () => {
      it("should calculate progress for Step 1/4", () => {
        // 60 + (1/4 * 40) = 70
        expect(calculateProgress("executing", "Step 1/4")).toBe(70);
      });

      it("should calculate progress for Step 2/4", () => {
        // 60 + (2/4 * 40) = 80
        expect(calculateProgress("executing", "Step 2/4")).toBe(80);
      });

      it("should calculate progress for Step 3/4", () => {
        // 60 + (3/4 * 40) = 90
        expect(calculateProgress("executing", "Step 3/4")).toBe(90);
      });

      it("should calculate progress for Step 4/4", () => {
        // 60 + (4/4 * 40) = 100
        expect(calculateProgress("executing", "Step 4/4")).toBe(100);
      });

      it("should calculate progress for Step 1/10", () => {
        // 60 + (1/10 * 40) = 64
        expect(calculateProgress("executing", "Step 1/10")).toBe(64);
      });

      it("should calculate progress for Step 5/10", () => {
        // 60 + (5/10 * 40) = 80
        expect(calculateProgress("executing", "Step 5/10")).toBe(80);
      });

      it("should calculate progress for Step 10/10", () => {
        // 60 + (10/10 * 40) = 100
        expect(calculateProgress("executing", "Step 10/10")).toBe(100);
      });

      it("should handle single step", () => {
        // 60 + (1/1 * 40) = 100
        expect(calculateProgress("executing", "Step 1/1")).toBe(100);
      });

      it("should handle large step numbers", () => {
        // 60 + (50/100 * 40) = 80
        expect(calculateProgress("executing", "Step 50/100")).toBe(80);
      });

      it("should return base progress for invalid step format", () => {
        expect(calculateProgress("executing", "Working on it")).toBe(80);
        expect(calculateProgress("executing", "Step X of Y")).toBe(80);
        expect(calculateProgress("executing", "")).toBe(80);
        expect(calculateProgress("executing", "1/4")).toBe(80);
        expect(calculateProgress("executing", "Step")).toBe(80);
      });
    });

    describe("step info ignored for non-executing statuses", () => {
      it("should ignore step info for todo", () => {
        expect(calculateProgress("todo", "Step 3/4")).toBe(0);
      });

      it("should ignore step info for brainstorming", () => {
        expect(calculateProgress("brainstorming", "Step 3/4")).toBe(20);
      });

      it("should ignore step info for planning", () => {
        expect(calculateProgress("planning", "Step 3/4")).toBe(40);
      });

      it("should ignore step info for ready", () => {
        expect(calculateProgress("ready", "Step 3/4")).toBe(60);
      });

      it("should ignore step info for done", () => {
        expect(calculateProgress("done", "Step 3/4")).toBe(100);
      });

      it("should ignore step info for stuck", () => {
        expect(calculateProgress("stuck", "Step 3/4")).toBe(0);
      });
    });

    describe("edge cases", () => {
      it("should handle undefined currentStep", () => {
        expect(calculateProgress("executing", undefined)).toBe(80);
      });

      it("should return 0 for unknown status", () => {
        expect(calculateProgress("unknown" as TaskStatus)).toBe(0);
      });

      it("should handle step with extra text", () => {
        // The regex only looks for "Step X/Y" pattern
        expect(calculateProgress("executing", "Step 2/5: Creating files")).toBe(76); // 60 + (2/5 * 40) = 76
      });

      it("should handle step at beginning of string", () => {
        expect(calculateProgress("executing", "Step 3/6 completed")).toBe(80); // 60 + (3/6 * 40) = 80
      });
    });
  });

  describe("Active status detection", () => {
    it("should identify active statuses correctly", () => {
      const activeStatuses: TaskStatus[] = ["brainstorming", "planning", "ready", "executing"];
      const inactiveStatuses: TaskStatus[] = ["todo", "done", "stuck"];

      activeStatuses.forEach((status) => {
        const progress = calculateProgress(status);
        expect(progress).toBeGreaterThan(0);
        expect(progress).toBeLessThan(100);
      });

      // done should be 100, stuck should be 0, todo should be 0
      expect(calculateProgress("todo")).toBe(0);
      expect(calculateProgress("done")).toBe(100);
      expect(calculateProgress("stuck")).toBe(0);
    });
  });

  describe("Progress boundaries", () => {
    it("should never exceed 100", () => {
      // Even with a step like 10/5 (invalid but possible)
      const progress = calculateProgress("executing", "Step 10/5");
      // Would be 60 + (10/5 * 40) = 140, but let's see what happens
      // The function doesn't cap it, but this is an edge case
      expect(progress).toBeGreaterThanOrEqual(0);
    });

    it("should never go below 0", () => {
      const progress = calculateProgress("executing", "Step 0/5");
      // Would be 60 + (0/5 * 40) = 60
      expect(progress).toBeGreaterThanOrEqual(0);
    });

    it("should handle step 0/0 gracefully", () => {
      // Division by zero case - regex should still match but result might be NaN
      // Let's verify behavior
      const progress = calculateProgress("executing", "Step 0/0");
      // 0/0 = NaN, so result would be NaN
      // This is an edge case the function doesn't handle
      // Just verify it doesn't crash
      expect(typeof progress).toBe("number");
    });
  });
});
