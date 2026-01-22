import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateProgressFromStatus,
  createWorkerUpdateEvent,
  type WorkerEvent,
  type WorkerEventData,
} from "@/lib/workers/events";
import type { TaskStatus } from "@/lib/db/schema";

describe("Worker Events Utilities", () => {
  describe("calculateProgressFromStatus", () => {
    it("should return correct progress for each status", () => {
      const statusProgressMap: Record<TaskStatus, number> = {
        todo: 0,
        brainstorming: 20,
        planning: 40,
        ready: 60,
        executing: 80,
        done: 100,
        stuck: 0,
      };

      for (const [status, expectedProgress] of Object.entries(statusProgressMap)) {
        expect(calculateProgressFromStatus(status as TaskStatus)).toBe(expectedProgress);
      }
    });

    it("should parse step progress for executing status", () => {
      // Step 1/4 = 60 + (1/4 * 40) = 70
      expect(calculateProgressFromStatus("executing", "Step 1/4")).toBe(70);

      // Step 2/4 = 60 + (2/4 * 40) = 80
      expect(calculateProgressFromStatus("executing", "Step 2/4")).toBe(80);

      // Step 3/4 = 60 + (3/4 * 40) = 90
      expect(calculateProgressFromStatus("executing", "Step 3/4")).toBe(90);

      // Step 4/4 = 60 + (4/4 * 40) = 100
      expect(calculateProgressFromStatus("executing", "Step 4/4")).toBe(100);
    });

    it("should handle different step formats", () => {
      // Step 3/6 = 60 + (3/6 * 40) = 80
      expect(calculateProgressFromStatus("executing", "Step 3/6")).toBe(80);

      // Step 5/10 = 60 + (5/10 * 40) = 80
      expect(calculateProgressFromStatus("executing", "Step 5/10")).toBe(80);

      // Step 1/1 = 60 + (1/1 * 40) = 100
      expect(calculateProgressFromStatus("executing", "Step 1/1")).toBe(100);
    });

    it("should return base progress if step format is invalid", () => {
      expect(calculateProgressFromStatus("executing", "Working...")).toBe(80);
      expect(calculateProgressFromStatus("executing", "Step X of Y")).toBe(80);
      expect(calculateProgressFromStatus("executing", "")).toBe(80);
    });

    it("should ignore currentStep for non-executing statuses", () => {
      expect(calculateProgressFromStatus("brainstorming", "Step 1/4")).toBe(20);
      expect(calculateProgressFromStatus("planning", "Step 2/4")).toBe(40);
      expect(calculateProgressFromStatus("done", "Step 4/4")).toBe(100);
    });

    it("should return 0 for unknown status", () => {
      expect(calculateProgressFromStatus("unknown" as TaskStatus)).toBe(0);
    });
  });

  describe("createWorkerUpdateEvent", () => {
    const baseParams = {
      taskId: "task-123",
      taskTitle: "Implement feature X",
      repoName: "my-repo",
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should create worker_update event for active statuses", () => {
      const activeStatuses: TaskStatus[] = ["brainstorming", "planning", "ready", "executing"];

      for (const status of activeStatuses) {
        const event = createWorkerUpdateEvent(
          baseParams.taskId,
          baseParams.taskTitle,
          baseParams.repoName,
          status
        );

        expect(event.type).toBe("worker_update");
        expect(event.data.taskId).toBe(baseParams.taskId);
        expect(event.data.taskTitle).toBe(baseParams.taskTitle);
        expect(event.data.repoName).toBe(baseParams.repoName);
        expect(event.data.status).toBe(status);
      }
    });

    it("should create worker_complete event for done status", () => {
      const event = createWorkerUpdateEvent(
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "done"
      );

      expect(event.type).toBe("worker_complete");
      expect(event.data.status).toBe("done");
      expect(event.data.progress).toBe(100);
    });

    it("should create worker_stuck event for stuck status", () => {
      const event = createWorkerUpdateEvent(
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "stuck",
        { error: "Failed to execute plan" }
      );

      expect(event.type).toBe("worker_stuck");
      expect(event.data.status).toBe("stuck");
      expect(event.data.error).toBe("Failed to execute plan");
    });

    it("should include optional fields when provided", () => {
      const completedAt = new Date("2024-01-15T10:25:00.000Z");
      const event = createWorkerUpdateEvent(
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "executing",
        {
          currentStep: "Step 3/5",
          currentAction: "Creating auth middleware",
          completedAt,
        }
      );

      expect(event.data.currentStep).toBe("Step 3/5");
      expect(event.data.currentAction).toBe("Creating auth middleware");
      expect(event.data.completedAt).toBe("2024-01-15T10:25:00.000Z");
      // Progress should be calculated based on step
      expect(event.data.progress).toBe(84); // 60 + (3/5 * 40) = 84
    });

    it("should include timestamps", () => {
      const event = createWorkerUpdateEvent(
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming"
      );

      expect(event.timestamp).toBe("2024-01-15T10:30:00.000Z");
      expect(event.data.updatedAt).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should calculate correct progress for each status", () => {
      const statusTests: { status: TaskStatus; expectedProgress: number }[] = [
        { status: "todo", expectedProgress: 0 },
        { status: "brainstorming", expectedProgress: 20 },
        { status: "planning", expectedProgress: 40 },
        { status: "ready", expectedProgress: 60 },
        { status: "executing", expectedProgress: 80 },
        { status: "done", expectedProgress: 100 },
        { status: "stuck", expectedProgress: 0 },
      ];

      for (const { status, expectedProgress } of statusTests) {
        const event = createWorkerUpdateEvent(
          baseParams.taskId,
          baseParams.taskTitle,
          baseParams.repoName,
          status
        );
        expect(event.data.progress).toBe(expectedProgress);
      }
    });

    it("should not include undefined optional fields", () => {
      const event = createWorkerUpdateEvent(
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming"
      );

      expect(event.data.currentStep).toBeUndefined();
      expect(event.data.currentAction).toBeUndefined();
      expect(event.data.error).toBeUndefined();
      expect(event.data.completedAt).toBeUndefined();
    });
  });

  describe("WorkerEvent type validation", () => {
    it("should have correct event type structure", () => {
      const event: WorkerEvent = {
        type: "worker_update",
        data: {
          taskId: "task-123",
          taskTitle: "Test task",
          repoName: "test-repo",
          status: "executing",
          progress: 80,
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      expect(event.type).toBe("worker_update");
      expect(event.data.taskId).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });
  });

  describe("WorkerEventData type validation", () => {
    it("should support all required fields", () => {
      const data: WorkerEventData = {
        taskId: "task-123",
        taskTitle: "Test task",
        repoName: "test-repo",
        status: "executing",
        progress: 80,
        updatedAt: new Date().toISOString(),
      };

      expect(data.taskId).toBe("task-123");
      expect(data.status).toBe("executing");
    });

    it("should support all optional fields", () => {
      const data: WorkerEventData = {
        taskId: "task-123",
        taskTitle: "Test task",
        repoName: "test-repo",
        status: "executing",
        progress: 80,
        currentStep: "Step 2/5",
        currentAction: "Writing tests",
        error: "Some error",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(data.currentStep).toBe("Step 2/5");
      expect(data.currentAction).toBe("Writing tests");
      expect(data.error).toBe("Some error");
      expect(data.completedAt).toBeDefined();
    });
  });
});
