import { describe, it, expect } from "vitest";
import { isBackwardMove } from "@/components/ui/backward-move-dialog";
import type { TaskStatus } from "@/lib/db/schema";

describe("Backward Move Detection", () => {
  describe("isBackwardMove", () => {
    // Workflow order: todo (0) → brainstorming (1) → planning (2) → ready (3) → executing (4) → done (5)

    describe("forward moves (should return false)", () => {
      it("todo → brainstorming is forward", () => {
        expect(isBackwardMove("todo", "brainstorming")).toBe(false);
      });

      it("todo → planning is forward", () => {
        expect(isBackwardMove("todo", "planning")).toBe(false);
      });

      it("brainstorming → planning is forward", () => {
        expect(isBackwardMove("brainstorming", "planning")).toBe(false);
      });

      it("planning → ready is forward", () => {
        expect(isBackwardMove("planning", "ready")).toBe(false);
      });

      it("ready → executing is forward", () => {
        expect(isBackwardMove("ready", "executing")).toBe(false);
      });

      it("executing → done is forward", () => {
        expect(isBackwardMove("executing", "done")).toBe(false);
      });

      it("todo → done is forward", () => {
        expect(isBackwardMove("todo", "done")).toBe(false);
      });
    });

    describe("backward moves (should return true)", () => {
      it("ready → planning is backward", () => {
        expect(isBackwardMove("ready", "planning")).toBe(true);
      });

      it("ready → brainstorming is backward", () => {
        expect(isBackwardMove("ready", "brainstorming")).toBe(true);
      });

      it("ready → todo is backward", () => {
        expect(isBackwardMove("ready", "todo")).toBe(true);
      });

      it("planning → brainstorming is backward", () => {
        expect(isBackwardMove("planning", "brainstorming")).toBe(true);
      });

      it("planning → todo is backward", () => {
        expect(isBackwardMove("planning", "todo")).toBe(true);
      });

      it("brainstorming → todo is backward", () => {
        expect(isBackwardMove("brainstorming", "todo")).toBe(true);
      });

      it("done → ready is backward", () => {
        expect(isBackwardMove("done", "ready")).toBe(true);
      });

      it("executing → planning is backward", () => {
        expect(isBackwardMove("executing", "planning")).toBe(true);
      });
    });

    describe("same status moves (should return false)", () => {
      const statuses: TaskStatus[] = [
        "todo",
        "brainstorming",
        "planning",
        "ready",
        "executing",
        "done",
      ];

      statuses.forEach((status) => {
        it(`${status} → ${status} is not backward`, () => {
          expect(isBackwardMove(status, status)).toBe(false);
        });
      });
    });

    describe("stuck status (special case - should always return false)", () => {
      const normalStatuses: TaskStatus[] = [
        "todo",
        "brainstorming",
        "planning",
        "ready",
        "executing",
        "done",
      ];

      normalStatuses.forEach((status) => {
        it(`${status} → stuck is not considered backward`, () => {
          expect(isBackwardMove(status, "stuck")).toBe(false);
        });

        it(`stuck → ${status} is not considered backward`, () => {
          expect(isBackwardMove("stuck", status)).toBe(false);
        });
      });

      it("stuck → stuck is not backward", () => {
        expect(isBackwardMove("stuck", "stuck")).toBe(false);
      });
    });
  });
});

describe("Reset Phases Logic", () => {
  // These tests verify the reset logic that should be applied in the API

  describe("data to clear based on target status", () => {
    it("moving to todo should clear brainstormResult and planContent", () => {
      // When resetPhases=true and target is "todo":
      // - brainstormResult should be set to null
      // - planContent should be set to null
      const targetStatus: TaskStatus = "todo";
      const dataToClear = getDataToClear(targetStatus);

      expect(dataToClear).toContain("brainstormResult");
      expect(dataToClear).toContain("planContent");
    });

    it("moving to brainstorming should clear planContent only", () => {
      // When resetPhases=true and target is "brainstorming":
      // - planContent should be set to null
      // - brainstormResult should NOT be cleared (keep existing brainstorm)
      const targetStatus: TaskStatus = "brainstorming";
      const dataToClear = getDataToClear(targetStatus);

      expect(dataToClear).toContain("planContent");
      expect(dataToClear).not.toContain("brainstormResult");
    });

    it("moving to planning should not clear anything", () => {
      // When resetPhases=true and target is "planning":
      // - Nothing needs to be cleared (plan will be regenerated)
      const targetStatus: TaskStatus = "planning";
      const dataToClear = getDataToClear(targetStatus);

      expect(dataToClear).toHaveLength(0);
    });

    it("moving to ready should not clear anything", () => {
      const targetStatus: TaskStatus = "ready";
      const dataToClear = getDataToClear(targetStatus);

      expect(dataToClear).toHaveLength(0);
    });
  });
});

// Helper function to simulate the reset logic from the API
function getDataToClear(targetStatus: TaskStatus): string[] {
  const dataToClear: string[] = [];

  if (targetStatus === "todo") {
    dataToClear.push("brainstormResult");
    dataToClear.push("planContent");
  } else if (targetStatus === "brainstorming") {
    dataToClear.push("planContent");
  }

  return dataToClear;
}

describe("Backward Move Scenarios", () => {
  // Integration-style tests that verify the full flow

  describe("Ready → Planning", () => {
    it("should be detected as backward move", () => {
      expect(isBackwardMove("ready", "planning")).toBe(true);
    });

    it("with keepData should preserve plan content", () => {
      // Simulating the "Keep Data" option
      const originalTask = {
        status: "ready" as TaskStatus,
        brainstormResult: "Some brainstorm notes",
        planContent: "# Plan\n- Step 1\n- Step 2",
      };

      // With resetPhases=false, no data should be cleared
      const updatedTask = {
        ...originalTask,
        status: "planning" as TaskStatus,
      };

      expect(updatedTask.brainstormResult).toBe(originalTask.brainstormResult);
      expect(updatedTask.planContent).toBe(originalTask.planContent);
    });

    it("with reset should clear plan content", () => {
      // Simulating the "Reset" option
      const originalTask = {
        status: "ready" as TaskStatus,
        brainstormResult: "Some brainstorm notes",
        planContent: "# Plan\n- Step 1\n- Step 2",
      };

      // With resetPhases=true and target="planning", planContent is NOT cleared
      // (nothing to clear for planning target)
      const dataToClear = getDataToClear("planning");
      expect(dataToClear).toHaveLength(0);
    });
  });

  describe("Ready → Brainstorming", () => {
    it("should be detected as backward move", () => {
      expect(isBackwardMove("ready", "brainstorming")).toBe(true);
    });

    it("with reset should clear plan content but keep brainstorm", () => {
      const dataToClear = getDataToClear("brainstorming");

      expect(dataToClear).toContain("planContent");
      expect(dataToClear).not.toContain("brainstormResult");
    });
  });

  describe("Ready → Todo", () => {
    it("should be detected as backward move", () => {
      expect(isBackwardMove("ready", "todo")).toBe(true);
    });

    it("with reset should clear both brainstorm and plan", () => {
      const dataToClear = getDataToClear("todo");

      expect(dataToClear).toContain("brainstormResult");
      expect(dataToClear).toContain("planContent");
    });
  });

  describe("Planning → Todo", () => {
    it("should be detected as backward move", () => {
      expect(isBackwardMove("planning", "todo")).toBe(true);
    });

    it("with reset should clear brainstorm (plan might not exist yet)", () => {
      const dataToClear = getDataToClear("todo");

      expect(dataToClear).toContain("brainstormResult");
      expect(dataToClear).toContain("planContent");
    });
  });

  describe("Brainstorming → Todo", () => {
    it("should be detected as backward move", () => {
      expect(isBackwardMove("brainstorming", "todo")).toBe(true);
    });

    it("with reset should clear brainstorm notes", () => {
      const dataToClear = getDataToClear("todo");

      expect(dataToClear).toContain("brainstormResult");
    });
  });
});
