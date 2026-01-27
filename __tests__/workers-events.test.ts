import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateProgressFromStatus,
  createWorkerUpdateEvent,
  createProcessingEvent,
  phaseStatusMessages,
  type WorkerEvent,
  type WorkerEventData,
  type ProcessingEvent,
  type ProcessingEventData,
} from "@/lib/workers/events";
import type { TaskStatus, ProcessingPhase } from "@/lib/db/schema";

describe("Worker Events Utilities", () => {
  describe("calculateProgressFromStatus", () => {
    it("should return correct progress for each status", () => {
      const statusProgressMap: Record<TaskStatus, number> = {
        todo: 0,
        brainstorming: 15,
        planning: 30,
        ready: 45,
        executing: 60,
        review: 85,
        done: 100,
        stuck: 0,
      };

      for (const [status, expectedProgress] of Object.entries(
        statusProgressMap,
      )) {
        expect(calculateProgressFromStatus(status as TaskStatus)).toBe(
          expectedProgress,
        );
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
      expect(calculateProgressFromStatus("executing", "Working...")).toBe(60);
      expect(calculateProgressFromStatus("executing", "Step X of Y")).toBe(60);
      expect(calculateProgressFromStatus("executing", "")).toBe(60);
    });

    it("should ignore currentStep for non-executing statuses", () => {
      expect(calculateProgressFromStatus("brainstorming", "Step 1/4")).toBe(15);
      expect(calculateProgressFromStatus("planning", "Step 2/4")).toBe(30);
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
      const activeStatuses: TaskStatus[] = [
        "brainstorming",
        "planning",
        "ready",
        "executing",
      ];

      for (const status of activeStatuses) {
        const event = createWorkerUpdateEvent(
          baseParams.taskId,
          baseParams.taskTitle,
          baseParams.repoName,
          status,
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
        "done",
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
        { error: "Failed to execute plan" },
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
        },
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
        "brainstorming",
      );

      expect(event.timestamp).toBe("2024-01-15T10:30:00.000Z");
      expect(event.data.updatedAt).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should calculate correct progress for each status", () => {
      const statusTests: { status: TaskStatus; expectedProgress: number }[] = [
        { status: "todo", expectedProgress: 0 },
        { status: "brainstorming", expectedProgress: 15 },
        { status: "planning", expectedProgress: 30 },
        { status: "ready", expectedProgress: 45 },
        { status: "executing", expectedProgress: 60 },
        { status: "done", expectedProgress: 100 },
        { status: "stuck", expectedProgress: 0 },
      ];

      for (const { status, expectedProgress } of statusTests) {
        const event = createWorkerUpdateEvent(
          baseParams.taskId,
          baseParams.taskTitle,
          baseParams.repoName,
          status,
        );
        expect(event.data.progress).toBe(expectedProgress);
      }
    });

    it("should not include undefined optional fields", () => {
      const event = createWorkerUpdateEvent(
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming",
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
          progress: 60,
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

  describe("phaseStatusMessages", () => {
    it("should have messages for all processing phases", () => {
      const phases: ProcessingPhase[] = [
        "brainstorming",
        "planning",
        "executing",
      ];

      for (const phase of phases) {
        expect(phaseStatusMessages[phase]).toBeDefined();
        expect(Array.isArray(phaseStatusMessages[phase])).toBe(true);
        expect(phaseStatusMessages[phase].length).toBeGreaterThan(0);
      }
    });

    it("should have brainstorming phase messages", () => {
      expect(phaseStatusMessages.brainstorming).toContain("Analyzing task...");
      expect(phaseStatusMessages.brainstorming).toContain(
        "Generating ideas...",
      );
      expect(phaseStatusMessages.brainstorming).toContain(
        "Finalizing brainstorm...",
      );
    });

    it("should have planning phase messages", () => {
      expect(phaseStatusMessages.planning).toContain("Reviewing brainstorm...");
      expect(phaseStatusMessages.planning).toContain("Designing plan...");
      expect(phaseStatusMessages.planning).toContain("Finalizing plan...");
    });

    it("should have executing phase messages", () => {
      expect(phaseStatusMessages.executing).toContain("Starting execution...");
      expect(phaseStatusMessages.executing).toContain("Running tasks...");
      expect(phaseStatusMessages.executing).toContain(
        "Completing execution...",
      );
    });
  });

  describe("createProcessingEvent", () => {
    const baseParams = {
      taskId: "task-123",
      taskTitle: "Implement feature X",
      repoName: "my-repo",
      jobId: "job-456",
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should create processing_start event", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_start",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming",
        baseParams.jobId,
        startedAt,
      );

      expect(event.type).toBe("processing_start");
      expect(event.data.taskId).toBe(baseParams.taskId);
      expect(event.data.taskTitle).toBe(baseParams.taskTitle);
      expect(event.data.repoName).toBe(baseParams.repoName);
      expect(event.data.processingPhase).toBe("brainstorming");
      expect(event.data.jobId).toBe(baseParams.jobId);
      expect(event.data.startedAt).toBe("2024-01-15T10:29:00.000Z");
    });

    it("should create processing_update event with progress", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_update",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "planning",
        baseParams.jobId,
        startedAt,
        { progress: 50, statusText: "Designing plan..." },
      );

      expect(event.type).toBe("processing_update");
      expect(event.data.processingPhase).toBe("planning");
      expect(event.data.progress).toBe(50);
      expect(event.data.statusText).toBe("Designing plan...");
    });

    it("should create processing_complete event with 100% progress", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_complete",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming",
        baseParams.jobId,
        startedAt,
        { progress: 75 }, // Should be overridden to 100
      );

      expect(event.type).toBe("processing_complete");
      expect(event.data.progress).toBe(100);
    });

    it("should create processing_error event with error message", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_error",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "executing",
        baseParams.jobId,
        startedAt,
        { error: "API rate limit exceeded", progress: 30 },
      );

      expect(event.type).toBe("processing_error");
      expect(event.data.error).toBe("API rate limit exceeded");
      expect(event.data.progress).toBe(30);
    });

    it("should use default status text from phase messages", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_start",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming",
        baseParams.jobId,
        startedAt,
      );

      // Should use first message from brainstorming phase
      expect(event.data.statusText).toBe("Analyzing task...");
    });

    it("should use custom status text when provided", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_update",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "brainstorming",
        baseParams.jobId,
        startedAt,
        { statusText: "Custom progress message" },
      );

      expect(event.data.statusText).toBe("Custom progress message");
    });

    it("should include timestamps", () => {
      const startedAt = new Date("2024-01-15T10:29:00.000Z");
      const event = createProcessingEvent(
        "processing_start",
        baseParams.taskId,
        baseParams.taskTitle,
        baseParams.repoName,
        "planning",
        baseParams.jobId,
        startedAt,
      );

      expect(event.timestamp).toBe("2024-01-15T10:30:00.000Z");
      expect(event.data.updatedAt).toBe("2024-01-15T10:30:00.000Z");
      expect(event.data.startedAt).toBe("2024-01-15T10:29:00.000Z");
    });

    it("should handle all processing phases", () => {
      const phases: ProcessingPhase[] = [
        "brainstorming",
        "planning",
        "executing",
      ];
      const startedAt = new Date("2024-01-15T10:29:00.000Z");

      for (const phase of phases) {
        const event = createProcessingEvent(
          "processing_start",
          baseParams.taskId,
          baseParams.taskTitle,
          baseParams.repoName,
          phase,
          baseParams.jobId,
          startedAt,
        );

        expect(event.data.processingPhase).toBe(phase);
        expect(event.data.statusText).toBe(phaseStatusMessages[phase][0]);
      }
    });
  });

  describe("ProcessingEvent type validation", () => {
    it("should have correct event type structure", () => {
      const event: ProcessingEvent = {
        type: "processing_update",
        data: {
          taskId: "task-123",
          taskTitle: "Test task",
          repoName: "test-repo",
          processingPhase: "brainstorming",
          statusText: "Analyzing...",
          progress: 50,
          jobId: "job-456",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      expect(event.type).toBe("processing_update");
      expect(event.data.processingPhase).toBe("brainstorming");
      expect(event.timestamp).toBeDefined();
    });
  });

  describe("ProcessingEventData type validation", () => {
    it("should support all required fields", () => {
      const data: ProcessingEventData = {
        taskId: "task-123",
        taskTitle: "Test task",
        repoName: "test-repo",
        processingPhase: "planning",
        statusText: "Working...",
        progress: 60,
        jobId: "job-789",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(data.taskId).toBe("task-123");
      expect(data.processingPhase).toBe("planning");
      expect(data.jobId).toBe("job-789");
    });

    it("should support optional error field", () => {
      const data: ProcessingEventData = {
        taskId: "task-123",
        taskTitle: "Test task",
        repoName: "test-repo",
        processingPhase: "executing",
        statusText: "Failed",
        progress: 25,
        jobId: "job-789",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: "Execution failed: timeout",
      };

      expect(data.error).toBe("Execution failed: timeout");
    });
  });
});
