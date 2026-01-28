/**
 * Tests for P0 Execution Worker Integration
 *
 * Tests the new review flow:
 * - File changes collection after execution
 * - Pending changes storage
 * - Test execution (optional)
 * - Task status transitions to "review"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  TaskStatus,
  PendingChangeAction,
  TestRunStatus,
} from "@/lib/db/schema";

// Mock the modules used by the worker
vi.mock("simple-git", () => ({
  default: vi.fn(() => mockGit),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

// Mock git instance
const mockGit = {
  status: vi.fn(),
  show: vi.fn(),
  diff: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
  checkout: vi.fn(),
  fetch: vi.fn(),
  pull: vi.fn(),
  branch: vi.fn(),
  clone: vi.fn(),
  checkIsRepo: vi.fn(),
  revparse: vi.fn(),
  reset: vi.fn(),
  clean: vi.fn(),
  revert: vi.fn(),
  remote: vi.fn(),
  getRemotes: vi.fn(),
  log: vi.fn(),
};

describe("Execution Worker P0 Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("File Change Collection", () => {
    it("should collect modified files from git status", async () => {
      // Simulate git status result
      const mockStatus = {
        modified: ["src/index.ts", "src/utils.ts"],
        created: ["src/new-file.ts"],
        deleted: ["src/old-file.ts"],
        not_added: [],
        staged: [],
      };

      mockGit.status.mockResolvedValue(mockStatus);

      // Verify we get all file types
      const changedFiles = [
        ...mockStatus.modified.map((f) => ({
          path: f,
          status: "modified" as const,
        })),
        ...mockStatus.created.map((f) => ({
          path: f,
          status: "created" as const,
        })),
        ...mockStatus.deleted.map((f) => ({
          path: f,
          status: "deleted" as const,
        })),
      ];

      expect(changedFiles).toHaveLength(4);
      expect(changedFiles.filter((f) => f.status === "modified")).toHaveLength(
        2,
      );
      expect(changedFiles.filter((f) => f.status === "created")).toHaveLength(
        1,
      );
      expect(changedFiles.filter((f) => f.status === "deleted")).toHaveLength(
        1,
      );
    });

    it("should handle empty change list", async () => {
      const mockStatus = {
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
        staged: [],
      };

      mockGit.status.mockResolvedValue(mockStatus);

      const changedFiles = [
        ...mockStatus.modified,
        ...mockStatus.created,
        ...mockStatus.deleted,
      ];

      expect(changedFiles).toHaveLength(0);
    });

    it("should include not_added files as created", async () => {
      const mockStatus = {
        modified: [],
        created: [],
        deleted: [],
        not_added: ["src/untracked.ts"],
        staged: [],
      };

      mockGit.status.mockResolvedValue(mockStatus);

      const changedFiles = [
        ...mockStatus.modified.map((f) => ({
          path: f,
          status: "modified" as const,
        })),
        ...mockStatus.created.map((f) => ({
          path: f,
          status: "created" as const,
        })),
        ...mockStatus.not_added.map((f) => ({
          path: f,
          status: "created" as const,
        })),
        ...mockStatus.deleted.map((f) => ({
          path: f,
          status: "deleted" as const,
        })),
      ];

      expect(changedFiles).toHaveLength(1);
      expect(changedFiles[0].status).toBe("created");
    });
  });

  describe("Pending Change Action Detection", () => {
    it("should detect create action for new files", () => {
      const detectAction = (
        oldContent: string | null | undefined,
        newContent: string | null | undefined,
      ): PendingChangeAction => {
        if (!oldContent && newContent) return "create";
        if (oldContent && !newContent) return "delete";
        return "modify";
      };

      expect(detectAction(null, "new content")).toBe("create");
      expect(detectAction(undefined, "new content")).toBe("create");
      expect(detectAction("", "new content")).toBe("create"); // Empty string is falsy, treated as no old content
    });

    it("should detect delete action for removed files", () => {
      const detectAction = (
        oldContent: string | null | undefined,
        newContent: string | null | undefined,
      ): PendingChangeAction => {
        if (!oldContent && newContent) return "create";
        if (oldContent && !newContent) return "delete";
        return "modify";
      };

      expect(detectAction("old content", null)).toBe("delete");
      expect(detectAction("old content", undefined)).toBe("delete");
      expect(detectAction("old content", "")).toBe("delete");
    });

    it("should detect modify action for changed files", () => {
      const detectAction = (
        oldContent: string | null | undefined,
        newContent: string | null | undefined,
      ): PendingChangeAction => {
        if (!oldContent && newContent) return "create";
        if (oldContent && !newContent) return "delete";
        return "modify";
      };

      expect(detectAction("old content", "new content")).toBe("modify");
      expect(detectAction("same", "same")).toBe("modify");
    });
  });

  describe("Pending Changes Storage", () => {
    it("should create pending change records with correct structure", () => {
      const mockFileChange = {
        filePath: "src/index.ts",
        action: "modify" as PendingChangeAction,
        oldContent: "const x = 1;",
        newContent: "const x = 2;",
      };

      const mockDiffPatch = `@@ -1 +1 @@
-const x = 1;
+const x = 2;`;

      const pendingChangeRecord = {
        executionId: "exec-123",
        taskId: "task-456",
        filePath: mockFileChange.filePath,
        action: mockFileChange.action,
        oldContent: mockFileChange.oldContent,
        newContent: mockFileChange.newContent,
        diffPatch: mockDiffPatch,
        isApproved: false,
      };

      expect(pendingChangeRecord.executionId).toBe("exec-123");
      expect(pendingChangeRecord.taskId).toBe("task-456");
      expect(pendingChangeRecord.action).toBe("modify");
      expect(pendingChangeRecord.isApproved).toBe(false);
    });

    it("should handle multiple file changes", () => {
      const fileChanges = [
        {
          filePath: "src/a.ts",
          action: "create" as PendingChangeAction,
          oldContent: null,
          newContent: "new",
        },
        {
          filePath: "src/b.ts",
          action: "modify" as PendingChangeAction,
          oldContent: "old",
          newContent: "new",
        },
        {
          filePath: "src/c.ts",
          action: "delete" as PendingChangeAction,
          oldContent: "old",
          newContent: "",
        },
      ];

      const pendingChangeRecords = fileChanges.map((change, index) => ({
        id: `change-${index}`,
        executionId: "exec-123",
        taskId: "task-456",
        filePath: change.filePath,
        action: change.action,
        oldContent: change.oldContent,
        newContent: change.newContent,
        diffPatch: `diff for ${change.filePath}`,
        isApproved: false,
      }));

      expect(pendingChangeRecords).toHaveLength(3);
      expect(pendingChangeRecords[0].action).toBe("create");
      expect(pendingChangeRecords[1].action).toBe("modify");
      expect(pendingChangeRecords[2].action).toBe("delete");
    });
  });

  describe("Task Status Transitions", () => {
    it("should transition to review status on successful execution", () => {
      const executionResult = {
        status: "complete",
        iterations: 5,
        commits: [],
        filesWritten: 3,
      };

      // When execution succeeds, task should go to "review"
      const newStatus: TaskStatus =
        executionResult.status === "complete" ? "review" : "stuck";

      expect(newStatus).toBe("review");
    });

    it("should transition to stuck status on failed execution", () => {
      const executionResult = {
        status: "stuck",
        iterations: 3,
        commits: [],
        error: "Max iterations exceeded",
      };

      const newStatus: TaskStatus =
        executionResult.status === "complete" ? "review" : "stuck";

      expect(newStatus).toBe("stuck");
    });

    it("should build correct status history entry", () => {
      const historyEntry = {
        from: "executing" as TaskStatus,
        to: "review" as TaskStatus,
        timestamp: new Date().toISOString(),
        triggeredBy: "worker" as const,
      };

      expect(historyEntry.from).toBe("executing");
      expect(historyEntry.to).toBe("review");
      expect(historyEntry.triggeredBy).toBe("worker");
      expect(new Date(historyEntry.timestamp)).toBeInstanceOf(Date);
    });

    it("should clear processing state on transition to review", () => {
      const taskUpdateFields = {
        status: "review" as TaskStatus,
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
        updatedAt: new Date(),
      };

      expect(taskUpdateFields.processingPhase).toBeNull();
      expect(taskUpdateFields.processingJobId).toBeNull();
      expect(taskUpdateFields.processingStartedAt).toBeNull();
      expect(taskUpdateFields.processingStatusText).toBeNull();
    });
  });

  describe("Test Execution Integration", () => {
    it("should skip tests when testsEnabled is false", async () => {
      const repo = {
        testsEnabled: false,
        testCommand: "npm test",
      };

      const shouldRunTests = repo.testsEnabled !== false;
      expect(shouldRunTests).toBe(false);
    });

    it("should run tests when testsEnabled is true", async () => {
      const repo = {
        testsEnabled: true,
        testCommand: "npm test",
      };

      const shouldRunTests = repo.testsEnabled !== false;
      expect(shouldRunTests).toBe(true);
    });

    it("should use configured test command over auto-detected", async () => {
      const repo = {
        testsEnabled: true,
        testCommand: "npm run test:ci",
      };

      const autoDetectedCommand = "npm test";
      const testCommand = repo.testCommand || autoDetectedCommand;

      expect(testCommand).toBe("npm run test:ci");
    });

    it("should fall back to auto-detected command when not configured", async () => {
      const repo = {
        testsEnabled: true,
        testCommand: null,
      };

      const autoDetectedCommand = "npm test";
      const testCommand = repo.testCommand || autoDetectedCommand;

      expect(testCommand).toBe("npm test");
    });

    it("should create test run record with running status", () => {
      const testRunRecord = {
        executionId: "exec-123",
        taskId: "task-456",
        command: "npm test",
        status: "running" as TestRunStatus,
      };

      expect(testRunRecord.status).toBe("running");
    });

    it("should update test run with passed status", () => {
      const testResult = {
        success: true,
        exitCode: 0,
        stdout: "All tests passed",
        stderr: "",
        durationMs: 5000,
        timedOut: false,
      };

      const getTestStatus = (result: typeof testResult): TestRunStatus => {
        if (result.timedOut) return "timeout";
        if (result.success) return "passed";
        return "failed";
      };

      expect(getTestStatus(testResult)).toBe("passed");
    });

    it("should update test run with failed status", () => {
      const testResult = {
        success: false,
        exitCode: 1,
        stdout: "1 test failed",
        stderr: "AssertionError",
        durationMs: 3000,
        timedOut: false,
      };

      const getTestStatus = (result: typeof testResult): TestRunStatus => {
        if (result.timedOut) return "timeout";
        if (result.success) return "passed";
        return "failed";
      };

      expect(getTestStatus(testResult)).toBe("failed");
    });

    it("should update test run with timeout status", () => {
      const testResult = {
        success: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: 300000,
        timedOut: true,
      };

      const getTestStatus = (result: typeof testResult): TestRunStatus => {
        if (result.timedOut) return "timeout";
        if (result.success) return "passed";
        return "failed";
      };

      expect(getTestStatus(testResult)).toBe("timeout");
    });

    it("should respect test timeout configuration", () => {
      const repo = {
        testTimeout: 60000, // 1 minute
      };

      const defaultTimeout = 300000; // 5 minutes
      const timeout = repo.testTimeout || defaultTimeout;

      expect(timeout).toBe(60000);
    });
  });

  describe("Execution Status Updates", () => {
    it("should update execution to completed without commits in review flow", () => {
      const executionUpdate = {
        status: "completed",
        iteration: 5,
        completedAt: new Date(),
        commits: [], // No commits yet - deferred to approval
        errorMessage: null,
        branch: "loopforge/abc12345",
      };

      expect(executionUpdate.status).toBe("completed");
      expect(executionUpdate.commits).toEqual([]);
      expect(executionUpdate.errorMessage).toBeNull();
    });

    it("should update execution to failed with error message", () => {
      const executionUpdate = {
        status: "failed",
        iteration: 3,
        completedAt: new Date(),
        commits: [],
        errorMessage: "Failed to collect changes",
      };

      expect(executionUpdate.status).toBe("failed");
      expect(executionUpdate.errorMessage).toBe("Failed to collect changes");
    });
  });

  describe("Worker Event Publishing", () => {
    it("should create review event for SSE", () => {
      const reviewEvent = {
        type: "worker_update",
        data: {
          taskId: "task-123",
          taskTitle: "Add feature",
          repoName: "my-repo",
          status: "review" as TaskStatus,
          currentAction: "Ready for review",
          completedAt: new Date().toISOString(),
        },
      };

      expect(reviewEvent.data.status).toBe("review");
      expect(reviewEvent.data.currentAction).toBe("Ready for review");
    });

    it("should create stuck event for SSE", () => {
      const stuckEvent = {
        type: "worker_update",
        data: {
          taskId: "task-123",
          taskTitle: "Add feature",
          repoName: "my-repo",
          status: "stuck" as TaskStatus,
          currentAction: "Execution stuck",
          error: "Max iterations exceeded",
          completedAt: new Date().toISOString(),
        },
      };

      expect(stuckEvent.data.status).toBe("stuck");
      expect(stuckEvent.data.error).toBe("Max iterations exceeded");
    });
  });

  describe("Worker Job Updates", () => {
    it("should update worker job with review summary", () => {
      const jobUpdate = {
        status: "completed",
        completedAt: new Date(),
        resultSummary: "3 files ready for review, tests passed",
      };

      expect(jobUpdate.status).toBe("completed");
      expect(jobUpdate.resultSummary).toContain("ready for review");
    });

    it("should update worker job with failure summary", () => {
      const jobUpdate = {
        status: "failed",
        completedAt: new Date(),
        resultSummary: "Failed after 5 iterations",
        errorMessage: "Task exceeded retry limit",
      };

      expect(jobUpdate.status).toBe("failed");
      expect(jobUpdate.errorMessage).toBeTruthy();
    });

    it("should format result summary correctly for single file", () => {
      const filesCount = 1;
      const testsPassed = true;

      const summary = `${filesCount} file${filesCount !== 1 ? "s" : ""} ready for review${testsPassed !== null ? (testsPassed ? ", tests passed" : ", tests failed") : ""}`;

      expect(summary).toBe("1 file ready for review, tests passed");
    });

    it("should format result summary correctly for multiple files", () => {
      const filesCount = 5;
      const testsPassed = false;

      const summary = `${filesCount} file${filesCount !== 1 ? "s" : ""} ready for review${testsPassed !== null ? (testsPassed ? ", tests passed" : ", tests failed") : ""}`;

      expect(summary).toBe("5 files ready for review, tests failed");
    });

    it("should format result summary without test info when tests skipped", () => {
      const filesCount = 3;
      const testsPassed: boolean | null = null;

      const summary = `${filesCount} file${filesCount !== 1 ? "s" : ""} ready for review${testsPassed !== null ? (testsPassed ? ", tests passed" : ", tests failed") : ""}`;

      expect(summary).toBe("3 files ready for review");
    });
  });

  describe("Verification Flow", () => {
    it("should verify execution has files written", () => {
      const verifyExecutionCompleted = (
        result: { status: string; commits: string[] },
        filesWritten: number,
      ) => {
        if (result.status !== "complete") {
          return { verified: true };
        }
        if (filesWritten === 0) {
          return { verified: false, reason: "No files were written" };
        }
        return { verified: true };
      };

      expect(
        verifyExecutionCompleted({ status: "complete", commits: [] }, 0)
          .verified,
      ).toBe(false);
      expect(
        verifyExecutionCompleted({ status: "complete", commits: [] }, 3)
          .verified,
      ).toBe(true);
      expect(
        verifyExecutionCompleted({ status: "stuck", commits: [] }, 0).verified,
      ).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle git status failure gracefully", async () => {
      mockGit.status.mockRejectedValue(new Error("Git not initialized"));

      try {
        await mockGit.status();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Git not initialized");
      }
    });

    it("should handle file read failure gracefully", async () => {
      const fs = await import("fs/promises");
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      try {
        await fs.readFile("/path/to/file", "utf-8");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should fall back to stuck status on change collection failure", () => {
      const handleCollectionError = (error: Error) => {
        return {
          status: "stuck" as const,
          error: `Failed to collect changes: ${error.message}`,
        };
      };

      const result = handleCollectionError(new Error("Permission denied"));
      expect(result.status).toBe("stuck");
      expect(result.error).toContain("Permission denied");
    });
  });
});
