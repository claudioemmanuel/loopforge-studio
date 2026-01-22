import { describe, it, expect } from "vitest";
import {
  createDefaultTimeline,
  type TimelineStage,
  type StageStatus,
  type TimelineStageData,
} from "@/components/workers/worker-timeline";

describe("Worker Timeline", () => {
  describe("createDefaultTimeline", () => {
    const allStages: TimelineStage[] = [
      "brainstorming",
      "planning",
      "ready",
      "executing",
      "done",
    ];

    it("should create timeline with all 5 stages", () => {
      const timeline = createDefaultTimeline("brainstorming");
      expect(timeline).toHaveLength(5);
      expect(timeline.map((s) => s.stage)).toEqual(allStages);
    });

    it("should mark previous stages as completed", () => {
      const timeline = createDefaultTimeline("planning");

      expect(timeline[0].status).toBe("completed"); // brainstorming
      expect(timeline[1].status).toBe("current");   // planning
      expect(timeline[2].status).toBe("pending");   // ready
      expect(timeline[3].status).toBe("pending");   // executing
      expect(timeline[4].status).toBe("pending");   // done
    });

    it("should mark current stage correctly", () => {
      for (let i = 0; i < allStages.length; i++) {
        const currentStage = allStages[i];
        const timeline = createDefaultTimeline(currentStage);

        // All stages before should be completed
        for (let j = 0; j < i; j++) {
          expect(timeline[j].status).toBe("completed");
        }

        // Current stage should be current
        expect(timeline[i].status).toBe("current");

        // All stages after should be pending
        for (let j = i + 1; j < allStages.length; j++) {
          expect(timeline[j].status).toBe("pending");
        }
      }
    });

    it("should handle brainstorming as first stage", () => {
      const timeline = createDefaultTimeline("brainstorming");

      expect(timeline[0].stage).toBe("brainstorming");
      expect(timeline[0].status).toBe("current");
      expect(timeline[1].status).toBe("pending");
      expect(timeline[2].status).toBe("pending");
      expect(timeline[3].status).toBe("pending");
      expect(timeline[4].status).toBe("pending");
    });

    it("should handle done as final stage", () => {
      const timeline = createDefaultTimeline("done");

      expect(timeline[0].status).toBe("completed"); // brainstorming
      expect(timeline[1].status).toBe("completed"); // planning
      expect(timeline[2].status).toBe("completed"); // ready
      expect(timeline[3].status).toBe("completed"); // executing
      expect(timeline[4].status).toBe("current");   // done
    });

    it("should handle executing stage", () => {
      const timeline = createDefaultTimeline("executing");

      expect(timeline[0].status).toBe("completed"); // brainstorming
      expect(timeline[1].status).toBe("completed"); // planning
      expect(timeline[2].status).toBe("completed"); // ready
      expect(timeline[3].status).toBe("current");   // executing
      expect(timeline[4].status).toBe("pending");   // done
    });

    it("should merge custom stage data when provided", () => {
      const stageData: Partial<Record<TimelineStage, Partial<TimelineStageData>>> = {
        brainstorming: {
          summary: "Generated 5 ideas",
          duration: 30,
        },
        planning: {
          currentAction: "Creating step 3...",
        },
      };

      const timeline = createDefaultTimeline("planning", stageData);

      expect(timeline[0].summary).toBe("Generated 5 ideas");
      expect(timeline[0].duration).toBe(30);
      expect(timeline[1].currentAction).toBe("Creating step 3...");
    });

    it("should preserve default stage status even with custom data", () => {
      const stageData: Partial<Record<TimelineStage, Partial<TimelineStageData>>> = {
        brainstorming: {
          summary: "Done brainstorming",
        },
      };

      const timeline = createDefaultTimeline("planning", stageData);

      // Custom data should be merged but status calculated correctly
      expect(timeline[0].summary).toBe("Done brainstorming");
      expect(timeline[0].status).toBe("completed");
    });

    it("should handle empty stageData", () => {
      const timeline = createDefaultTimeline("ready", {});

      expect(timeline).toHaveLength(5);
      expect(timeline[2].status).toBe("current");
    });

    it("should handle undefined stageData", () => {
      const timeline = createDefaultTimeline("ready", undefined);

      expect(timeline).toHaveLength(5);
      expect(timeline[2].status).toBe("current");
    });

    it("should include timestamps when provided", () => {
      const timestamp = new Date("2024-01-15T10:30:00.000Z");
      const stageData: Partial<Record<TimelineStage, Partial<TimelineStageData>>> = {
        brainstorming: {
          timestamp,
        },
      };

      const timeline = createDefaultTimeline("planning", stageData);

      expect(timeline[0].timestamp).toEqual(timestamp);
    });

    it("should include details array when provided", () => {
      const stageData: Partial<Record<TimelineStage, Partial<TimelineStageData>>> = {
        brainstorming: {
          details: ["Idea 1: Add caching", "Idea 2: Optimize queries", "Idea 3: Add indexes"],
        },
      };

      const timeline = createDefaultTimeline("planning", stageData);

      expect(timeline[0].details).toHaveLength(3);
      expect(timeline[0].details?.[0]).toBe("Idea 1: Add caching");
    });

    it("should include progress for executing stage", () => {
      const stageData: Partial<Record<TimelineStage, Partial<TimelineStageData>>> = {
        executing: {
          progress: 75,
          currentAction: "Step 3/4: Creating tests",
        },
      };

      const timeline = createDefaultTimeline("executing", stageData);

      expect(timeline[3].progress).toBe(75);
      expect(timeline[3].currentAction).toBe("Step 3/4: Creating tests");
    });
  });

  describe("TimelineStage type", () => {
    it("should only allow valid stage values", () => {
      const validStages: TimelineStage[] = [
        "brainstorming",
        "planning",
        "ready",
        "executing",
        "done",
      ];

      validStages.forEach((stage) => {
        const timeline = createDefaultTimeline(stage);
        expect(timeline.find((s) => s.stage === stage)).toBeDefined();
      });
    });
  });

  describe("StageStatus type", () => {
    it("should assign correct statuses", () => {
      const timeline = createDefaultTimeline("ready");

      const statuses = timeline.map((s) => s.status);
      const validStatuses: StageStatus[] = ["completed", "current", "pending"];

      statuses.forEach((status) => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe("Timeline progression scenarios", () => {
    it("should correctly show progression from todo to done", () => {
      // Simulate progression through stages
      const progressionStages: TimelineStage[] = [
        "brainstorming",
        "planning",
        "ready",
        "executing",
        "done",
      ];

      for (let i = 0; i < progressionStages.length; i++) {
        const timeline = createDefaultTimeline(progressionStages[i]);

        // Count statuses
        const completedCount = timeline.filter((s) => s.status === "completed").length;
        const currentCount = timeline.filter((s) => s.status === "current").length;
        const pendingCount = timeline.filter((s) => s.status === "pending").length;

        expect(completedCount).toBe(i);
        expect(currentCount).toBe(1);
        expect(pendingCount).toBe(4 - i);
      }
    });

    it("should handle stuck scenario (stage remains current)", () => {
      // If a task gets stuck at executing, it should show executing as current
      const timeline = createDefaultTimeline("executing");

      expect(timeline[3].status).toBe("current");
      expect(timeline[3].stage).toBe("executing");
    });
  });
});
