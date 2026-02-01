import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlanJobData, PlanJobResult } from "@/lib/queue/plan-queue";

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

describe("Plan Queue", () => {
  describe("PlanJobData interface", () => {
    it("should have all required fields", () => {
      const jobData: PlanJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        brainstormResult: '{"summary": "Task analysis"}',
        continueToExecution: false,
        repoName: "test-repo",
        repoFullName: "owner/test-repo",
        repoDefaultBranch: "main",
      };

      expect(jobData.taskId).toBe("task-123");
      expect(jobData.userId).toBe("user-456");
      expect(jobData.repoId).toBe("repo-789");
      expect(jobData.brainstormResult).toBe('{"summary": "Task analysis"}');
      expect(jobData.continueToExecution).toBe(false);
      expect(jobData.repoName).toBe("test-repo");
      expect(jobData.repoFullName).toBe("owner/test-repo");
      expect(jobData.repoDefaultBranch).toBe("main");
    });

    it("should not include sensitive fields like apiKey", () => {
      // PlanJobData no longer contains apiKey, aiProvider, or preferredModel.
      // Workers decrypt API keys on demand using userId.
      const jobData: PlanJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        brainstormResult: "{}",
        continueToExecution: true,
        repoName: "test-repo",
        repoFullName: "owner/test-repo",
        repoDefaultBranch: "main",
      };
      expect(jobData).not.toHaveProperty("apiKey");
      expect(jobData).not.toHaveProperty("aiProvider");
      expect(jobData).not.toHaveProperty("preferredModel");
    });

    it("should include brainstorm result from previous phase", () => {
      const brainstormResult = JSON.stringify({
        summary: "Add user authentication",
        requirements: ["Login", "Logout", "Password reset"],
        considerations: ["Security", "Session management"],
        suggestedApproach: "Use NextAuth with JWT",
      });

      const jobData: PlanJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        brainstormResult,
        continueToExecution: false,
        repoName: "test-repo",
        repoFullName: "owner/test-repo",
        repoDefaultBranch: "main",
      };

      const parsed = JSON.parse(jobData.brainstormResult);
      expect(parsed.summary).toBe("Add user authentication");
      expect(parsed.requirements).toHaveLength(3);
    });

    it("should support autonomous mode with continueToExecution flag", () => {
      const autonomousJob: PlanJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        brainstormResult: "{}",
        continueToExecution: true,
        repoName: "test-repo",
        repoFullName: "owner/test-repo",
        repoDefaultBranch: "main",
      };

      expect(autonomousJob.continueToExecution).toBe(true);
    });
  });

  describe("PlanJobResult interface", () => {
    it("should represent successful result", () => {
      const result: PlanJobResult = {
        success: true,
        planContent:
          "# Implementation Plan\n\n1. Create auth module\n2. Add routes",
        branch: "feature/add-auth",
        completedAt: new Date(),
      };

      expect(result.success).toBe(true);
      expect(result.planContent).toContain("Implementation Plan");
      expect(result.branch).toBe("feature/add-auth");
      expect(result.error).toBeUndefined();
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("should represent failed result", () => {
      const result: PlanJobResult = {
        success: false,
        error: "Failed to generate plan: insufficient context",
        completedAt: new Date(),
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to generate plan: insufficient context",
      );
      expect(result.planContent).toBeUndefined();
      expect(result.branch).toBeUndefined();
    });

    it("should include branch name for git integration", () => {
      const result: PlanJobResult = {
        success: true,
        planContent: "Plan content here",
        branch: "feature/task-123-add-auth",
        completedAt: new Date(),
      };

      expect(result.branch).toBe("feature/task-123-add-auth");
    });

    it("should include completedAt timestamp", () => {
      const now = new Date();
      const result: PlanJobResult = {
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
      const { queuePlan, getPlanJobStatus, createPlanWorker } =
        await import("@/lib/queue/plan-queue");

      expect(queuePlan).toBeDefined();
      expect(getPlanJobStatus).toBeDefined();
      expect(createPlanWorker).toBeDefined();
    });

    it("should queue a plan job", async () => {
      const { queuePlan, planQueue } = await import("@/lib/queue/plan-queue");

      const jobData: PlanJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        brainstormResult: '{"summary": "test"}',
        continueToExecution: false,
        repoName: "test-repo",
        repoFullName: "owner/test-repo",
        repoDefaultBranch: "main",
      };

      const job = await queuePlan(jobData);
      expect(job).toBeDefined();
      expect(planQueue.add).toHaveBeenCalledWith("plan", jobData, {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });
    });

    it("should get job status by ID", async () => {
      const { getPlanJobStatus, planQueue } =
        await import("@/lib/queue/plan-queue");

      // Mock job not found
      (planQueue.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const status = await getPlanJobStatus("non-existent");
      expect(status).toBeNull();
    });

    it("should return job status when job exists", async () => {
      const { getPlanJobStatus, planQueue } =
        await import("@/lib/queue/plan-queue");

      const mockJob = {
        id: "job-456",
        progress: 75,
        data: { taskId: "task-123", brainstormResult: "{}" },
        returnvalue: { success: true, planContent: "Plan" },
        failedReason: null,
        getState: vi.fn().mockResolvedValue("completed"),
      };

      (planQueue.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockJob,
      );

      const status = await getPlanJobStatus("job-456");
      expect(status).toEqual({
        id: "job-456",
        state: "completed",
        progress: 75,
        data: { taskId: "task-123", brainstormResult: "{}" },
        returnValue: { success: true, planContent: "Plan" },
        failedReason: null,
      });
    });

    it("should return job status with failed state", async () => {
      const { getPlanJobStatus, planQueue } =
        await import("@/lib/queue/plan-queue");

      const mockJob = {
        id: "job-789",
        progress: 30,
        data: { taskId: "task-123" },
        returnvalue: null,
        failedReason: "AI service unavailable",
        getState: vi.fn().mockResolvedValue("failed"),
      };

      (planQueue.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockJob,
      );

      const status = await getPlanJobStatus("job-789");
      expect(status?.state).toBe("failed");
      expect(status?.failedReason).toBe("AI service unavailable");
    });
  });

  describe("Worker creation", () => {
    it("should create a worker with processor function", async () => {
      const { createPlanWorker } = await import("@/lib/queue/plan-queue");

      const processor = vi.fn().mockResolvedValue({
        success: true,
        planContent: "Generated plan",
        branch: "feature/test",
        completedAt: new Date(),
      });

      const worker = createPlanWorker(processor);
      expect(worker).toBeDefined();
    });
  });

  describe("Job data flow", () => {
    it("should support the full brainstorm -> plan flow", () => {
      // Simulate brainstorm result
      const brainstormResult = JSON.stringify({
        summary: "Implement user registration",
        requirements: [
          "Create signup form",
          "Email validation",
          "Password rules",
        ],
        considerations: ["GDPR compliance", "Rate limiting"],
        suggestedApproach: "Use React Hook Form with Zod validation",
      });

      // Plan job uses brainstorm result
      const planJobData: PlanJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
        brainstormResult,
        continueToExecution: true,
        repoName: "test-repo",
        repoFullName: "owner/test-repo",
        repoDefaultBranch: "main",
      };

      // Verify the data can be properly parsed
      const parsed = JSON.parse(planJobData.brainstormResult);
      expect(parsed.summary).toBe("Implement user registration");
      expect(planJobData.continueToExecution).toBe(true);
    });
  });
});
