/**
 * Task Adapter Tests
 *
 * Verifies mapping between domain models and API formats.
 */

import { describe, it, expect } from "vitest";
import {
  TaskAdapter,
  type TaskApiResponse,
  type TaskApiRequest,
} from "@/lib/contexts/task/api/adapters";
import type { TaskState } from "@/lib/contexts/task/domain/task-aggregate";
import type {
  TaskMetadata,
  TaskConfiguration,
  BrainstormResult,
  ExecutionResult,
} from "@/lib/contexts/task/domain/types";

describe("TaskAdapter", () => {
  describe("toApiResponse", () => {
    it("should map all fields correctly with full data", () => {
      const now = new Date();
      const state: TaskState = {
        id: "task-1",
        repositoryId: "repo-1",
        metadata: {
          title: "Fix authentication bug",
          description: "Users unable to login",
          priority: 5,
        },
        status: "executing",
        processingState: {
          phase: "executing",
          jobId: "job-123",
          startedAt: now,
          statusText: "Running tests",
          progress: 50,
        },
        brainstormResult: {
          summary: "Need to check OAuth flow",
          conversation: [
            { role: "user", content: "Help me", timestamp: now },
            { role: "assistant", content: "Sure", timestamp: now },
          ],
          messageCount: 2,
          compactedAt: now,
        },
        planContent: "# Plan\n1. Check OAuth\n2. Fix bug",
        executionResult: {
          executionId: "exec-1",
          branchName: "loopforge/task-1",
          commitCount: 3,
          prUrl: "https://github.com/owner/repo/pull/42",
          prNumber: 42,
        },
        configuration: {
          autonomousMode: true,
          autoApprove: false,
          prTargetBranch: "main",
          prDraft: true,
        },
        blockedByIds: ["task-0"],
        statusHistory: [
          { status: "todo", timestamp: now },
          { status: "executing", timestamp: now, reason: "Auto-started" },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const response = TaskAdapter.toApiResponse(state);

      // Identity
      expect(response.id).toBe("task-1");
      expect(response.repoId).toBe("repo-1");

      // Metadata
      expect(response.title).toBe("Fix authentication bug");
      expect(response.description).toBe("Users unable to login");
      expect(response.status).toBe("executing");
      expect(response.priority).toBe(5);

      // Brainstorm
      expect(response.brainstormSummary).toBe("Need to check OAuth flow");
      expect(response.brainstormConversation).toBe(
        JSON.stringify(state.brainstormResult!.conversation),
      );
      expect(response.brainstormMessageCount).toBe(2);
      expect(response.brainstormCompactedAt).toBe(now);

      // Plan
      expect(response.planContent).toBe("# Plan\n1. Check OAuth\n2. Fix bug");

      // Execution
      expect(response.branch).toBe("loopforge/task-1");
      expect(response.prUrl).toBe("https://github.com/owner/repo/pull/42");
      expect(response.prNumber).toBe(42);

      // Configuration
      expect(response.autonomousMode).toBe(true);
      expect(response.autoApprove).toBe(false);
      expect(response.prTargetBranch).toBe("main");
      expect(response.prDraft).toBe(true);

      // Processing state
      expect(response.processingPhase).toBe("executing");
      expect(response.processingJobId).toBe("job-123");
      expect(response.processingStartedAt).toBe(now);
      expect(response.processingStatusText).toBe("Running tests");
      expect(response.processingProgress).toBe(50);

      // Dependencies
      expect(response.blockedByIds).toEqual(["task-0"]);

      // History
      expect(response.statusHistory).toHaveLength(2);
      expect(response.statusHistory[0].status).toBe("todo");
      expect(response.statusHistory[1].status).toBe("executing");
      expect(response.statusHistory[1].reason).toBe("Auto-started");

      // Timestamps
      expect(response.createdAt).toBe(now);
      expect(response.updatedAt).toBe(now);
    });

    it("should handle null brainstorm result", () => {
      const state: TaskState = {
        id: "task-2",
        repositoryId: "repo-1",
        metadata: { title: "New task", priority: 1 },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.brainstormSummary).toBeNull();
      expect(response.brainstormConversation).toBeNull();
      expect(response.brainstormMessageCount).toBeNull();
      expect(response.brainstormCompactedAt).toBeNull();
    });

    it("should handle undefined description", () => {
      const state: TaskState = {
        id: "task-3",
        repositoryId: "repo-1",
        metadata: { title: "Task without description", priority: 1 },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.description).toBeNull();
    });

    it("should handle null execution result", () => {
      const state: TaskState = {
        id: "task-4",
        repositoryId: "repo-1",
        metadata: { title: "Task", priority: 1 },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.branch).toBeNull();
      expect(response.prUrl).toBeNull();
      expect(response.prNumber).toBeNull();
    });

    it("should handle execution result without PR", () => {
      const state: TaskState = {
        id: "task-5",
        repositoryId: "repo-1",
        metadata: { title: "Task", priority: 1 },
        status: "executing",
        processingState: {
          phase: "executing",
          jobId: "job-1",
          startedAt: new Date(),
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: {
          executionId: "exec-1",
          branchName: "loopforge/task-5",
          commitCount: 1,
        },
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.branch).toBe("loopforge/task-5");
      expect(response.prUrl).toBeNull();
      expect(response.prNumber).toBeNull();
    });

    it("should handle empty blocked by array", () => {
      const state: TaskState = {
        id: "task-6",
        repositoryId: "repo-1",
        metadata: { title: "Task", priority: 1 },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.blockedByIds).toEqual([]);
    });

    it("should handle optional configuration fields", () => {
      const state: TaskState = {
        id: "task-7",
        repositoryId: "repo-1",
        metadata: { title: "Task", priority: 1 },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: {
          autonomousMode: true,
          autoApprove: true,
          // No prTargetBranch or prDraft
        },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.autonomousMode).toBe(true);
      expect(response.autoApprove).toBe(true);
      expect(response.prTargetBranch).toBeNull();
      expect(response.prDraft).toBeNull();
    });
  });

  describe("fromApiRequest", () => {
    it("should extract title only", () => {
      const body: TaskApiRequest = {
        title: "New task title",
      };

      const metadata = TaskAdapter.fromApiRequest(body);

      expect(metadata.title).toBe("New task title");
      expect(metadata.description).toBeUndefined();
      expect(metadata.priority).toBeUndefined();
    });

    it("should extract description only", () => {
      const body: TaskApiRequest = {
        description: "Task description",
      };

      const metadata = TaskAdapter.fromApiRequest(body);

      expect(metadata.title).toBeUndefined();
      expect(metadata.description).toBe("Task description");
      expect(metadata.priority).toBeUndefined();
    });

    it("should extract priority only", () => {
      const body: TaskApiRequest = {
        priority: 10,
      };

      const metadata = TaskAdapter.fromApiRequest(body);

      expect(metadata.title).toBeUndefined();
      expect(metadata.description).toBeUndefined();
      expect(metadata.priority).toBe(10);
    });

    it("should extract all metadata fields", () => {
      const body: TaskApiRequest = {
        title: "Complete task",
        description: "Full description",
        priority: 5,
      };

      const metadata = TaskAdapter.fromApiRequest(body);

      expect(metadata.title).toBe("Complete task");
      expect(metadata.description).toBe("Full description");
      expect(metadata.priority).toBe(5);
    });

    it("should handle empty body", () => {
      const body: TaskApiRequest = {};

      const metadata = TaskAdapter.fromApiRequest(body);

      expect(metadata).toEqual({});
    });

    it("should preserve explicit undefined values", () => {
      const body: TaskApiRequest = {
        title: "Title",
        description: undefined,
      };

      const metadata = TaskAdapter.fromApiRequest(body);

      expect(metadata.title).toBe("Title");
      expect(metadata.description).toBeUndefined();
    });
  });

  describe("toConfiguration", () => {
    it("should extract autonomousMode only", () => {
      const body: TaskApiRequest = {
        autonomousMode: true,
      };

      const config = TaskAdapter.toConfiguration(body);

      expect(config.autonomousMode).toBe(true);
      expect(config.autoApprove).toBeUndefined();
      expect(config.prTargetBranch).toBeUndefined();
      expect(config.prDraft).toBeUndefined();
    });

    it("should extract autoApprove only", () => {
      const body: TaskApiRequest = {
        autoApprove: false,
      };

      const config = TaskAdapter.toConfiguration(body);

      expect(config.autonomousMode).toBeUndefined();
      expect(config.autoApprove).toBe(false);
      expect(config.prTargetBranch).toBeUndefined();
      expect(config.prDraft).toBeUndefined();
    });

    it("should extract PR configuration only", () => {
      const body: TaskApiRequest = {
        prTargetBranch: "develop",
        prDraft: true,
      };

      const config = TaskAdapter.toConfiguration(body);

      expect(config.autonomousMode).toBeUndefined();
      expect(config.autoApprove).toBeUndefined();
      expect(config.prTargetBranch).toBe("develop");
      expect(config.prDraft).toBe(true);
    });

    it("should extract all configuration fields", () => {
      const body: TaskApiRequest = {
        autonomousMode: true,
        autoApprove: true,
        prTargetBranch: "main",
        prDraft: false,
      };

      const config = TaskAdapter.toConfiguration(body);

      expect(config.autonomousMode).toBe(true);
      expect(config.autoApprove).toBe(true);
      expect(config.prTargetBranch).toBe("main");
      expect(config.prDraft).toBe(false);
    });

    it("should handle empty body", () => {
      const body: TaskApiRequest = {};

      const config = TaskAdapter.toConfiguration(body);

      expect(config).toEqual({});
    });

    it("should handle boolean false values correctly", () => {
      const body: TaskApiRequest = {
        autonomousMode: false,
        autoApprove: false,
        prDraft: false,
      };

      const config = TaskAdapter.toConfiguration(body);

      expect(config.autonomousMode).toBe(false);
      expect(config.autoApprove).toBe(false);
      expect(config.prDraft).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle brainstorm conversation serialization", () => {
      const conversation = [
        { role: "user" as const, content: "Hello", timestamp: new Date() },
        {
          role: "assistant" as const,
          content: "Hi there",
          timestamp: new Date(),
        },
      ];

      const state: TaskState = {
        id: "task-8",
        repositoryId: "repo-1",
        metadata: { title: "Task", priority: 1 },
        status: "brainstorming",
        processingState: {
          phase: "brainstorming",
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: {
          summary: "Summary",
          conversation,
          messageCount: 2,
        },
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.brainstormConversation).toBe(
        JSON.stringify(conversation),
      );

      // Verify it's valid JSON
      const parsed = JSON.parse(response.brainstormConversation!);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].role).toBe("user");
      expect(parsed[1].role).toBe("assistant");
    });

    it("should handle very long status history", () => {
      const history = Array.from({ length: 100 }, (_, i) => ({
        status: "todo" as const,
        timestamp: new Date(),
        reason: `Transition ${i}`,
      }));

      const state: TaskState = {
        id: "task-9",
        repositoryId: "repo-1",
        metadata: { title: "Task", priority: 1 },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: history,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.statusHistory).toHaveLength(100);
      expect(response.statusHistory[50].reason).toBe("Transition 50");
    });

    it("should handle special characters in strings", () => {
      const state: TaskState = {
        id: "task-10",
        repositoryId: "repo-1",
        metadata: {
          title: "Task with \"quotes\" and 'apostrophes'",
          description: "Line 1\nLine 2\tTabbed",
          priority: 1,
        },
        status: "todo",
        processingState: {
          phase: null,
          jobId: null,
          startedAt: null,
          statusText: null,
          progress: 0,
        },
        brainstormResult: null,
        planContent: null,
        executionResult: null,
        configuration: { autonomousMode: false, autoApprove: false },
        blockedByIds: [],
        statusHistory: [{ status: "todo", timestamp: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = TaskAdapter.toApiResponse(state);

      expect(response.title).toBe("Task with \"quotes\" and 'apostrophes'");
      expect(response.description).toBe("Line 1\nLine 2\tTabbed");
    });
  });
});
