import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  BrainstormJobData,
  BrainstormJobResult,
} from "@/lib/queue/brainstorm-queue";

// Mock bullmq to avoid Redis connection
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    getJob: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation(() => ({})),
}));

// Mock connection options
vi.mock("@/lib/queue/connection", () => ({
  connectionOptions: {
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  },
  createConnectionOptions: vi.fn(() => ({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  })),
}));

describe("Brainstorm Queue", () => {
  describe("BrainstormJobData interface", () => {
    it("should have all required fields", () => {
      const jobData: BrainstormJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        apiKey: "encrypted-key",
        aiProvider: "anthropic",
        preferredModel: "claude-sonnet-4-20250514",
        continueToPlanning: false,
      };

      expect(jobData.taskId).toBe("task-123");
      expect(jobData.userId).toBe("user-456");
      expect(jobData.repoId).toBe("repo-789");
      expect(jobData.apiKey).toBe("encrypted-key");
      expect(jobData.aiProvider).toBe("anthropic");
      expect(jobData.preferredModel).toBe("claude-sonnet-4-20250514");
      expect(jobData.continueToPlanning).toBe(false);
    });

    it("should support all AI providers", () => {
      const providers = ["anthropic", "openai", "gemini"] as const;

      for (const provider of providers) {
        const jobData: BrainstormJobData = {
          taskId: "task-123",
          userId: "user-456",
          repoId: "repo-789",
          apiKey: "key",
          aiProvider: provider,
          preferredModel: "model",
          continueToPlanning: true,
        };
        expect(jobData.aiProvider).toBe(provider);
      }
    });

    it("should support autonomous mode with continueToPlanning flag", () => {
      const autonomousJob: BrainstormJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        apiKey: "key",
        aiProvider: "anthropic",
        preferredModel: "model",
        continueToPlanning: true,
      };

      expect(autonomousJob.continueToPlanning).toBe(true);
    });
  });

  describe("BrainstormJobResult interface", () => {
    it("should represent successful result", () => {
      const result: BrainstormJobResult = {
        success: true,
        brainstormResult: '{"summary": "Task analysis complete"}',
        completedAt: new Date(),
      };

      expect(result.success).toBe(true);
      expect(result.brainstormResult).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("should represent failed result", () => {
      const result: BrainstormJobResult = {
        success: false,
        error: "API rate limit exceeded",
        completedAt: new Date(),
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("API rate limit exceeded");
      expect(result.brainstormResult).toBeUndefined();
    });

    it("should include completedAt timestamp", () => {
      const now = new Date();
      const result: BrainstormJobResult = {
        success: true,
        completedAt: now,
      };

      expect(result.completedAt).toEqual(now);
    });
  });

  describe("Queue operations", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should be able to import queue functions", async () => {
      const { queueBrainstorm, getBrainstormJobStatus, createBrainstormWorker } =
        await import("@/lib/queue/brainstorm-queue");

      expect(queueBrainstorm).toBeDefined();
      expect(getBrainstormJobStatus).toBeDefined();
      expect(createBrainstormWorker).toBeDefined();
    });

    it("should queue a brainstorm job", async () => {
      const { queueBrainstorm, brainstormQueue } = await import(
        "@/lib/queue/brainstorm-queue"
      );

      const jobData: BrainstormJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        apiKey: "key",
        aiProvider: "anthropic",
        preferredModel: "model",
        continueToPlanning: false,
      };

      const job = await queueBrainstorm(jobData);
      expect(job).toBeDefined();
      expect(brainstormQueue.add).toHaveBeenCalledWith("brainstorm", jobData, {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });
    });

    it("should get job status by ID", async () => {
      const { getBrainstormJobStatus, brainstormQueue } = await import(
        "@/lib/queue/brainstorm-queue"
      );

      // Mock job not found
      (brainstormQueue.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const status = await getBrainstormJobStatus("non-existent");
      expect(status).toBeNull();
    });

    it("should return job status when job exists", async () => {
      const { getBrainstormJobStatus, brainstormQueue } = await import(
        "@/lib/queue/brainstorm-queue"
      );

      const mockJob = {
        id: "job-123",
        progress: 50,
        data: { taskId: "task-123" },
        returnvalue: null,
        failedReason: null,
        getState: vi.fn().mockResolvedValue("active"),
      };

      (brainstormQueue.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockJob);

      const status = await getBrainstormJobStatus("job-123");
      expect(status).toEqual({
        id: "job-123",
        state: "active",
        progress: 50,
        data: { taskId: "task-123" },
        returnValue: null,
        failedReason: null,
      });
    });
  });

  describe("Worker creation", () => {
    it("should create a worker with processor function", async () => {
      const { createBrainstormWorker } = await import(
        "@/lib/queue/brainstorm-queue"
      );

      const processor = vi.fn().mockResolvedValue({
        success: true,
        completedAt: new Date(),
      });

      const worker = createBrainstormWorker(processor);
      expect(worker).toBeDefined();
    });
  });
});
