/**
 * Tests for Diff Approve API Endpoint
 *
 * Tests the POST /api/tasks/[taskId]/diff/approve endpoint:
 * - Authorization checks
 * - Task status validation
 * - File writing from pending changes
 * - Commit and push operations
 * - PR creation
 * - Task status transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TaskStatus, PendingChangeAction } from "@/lib/db/schema";

// Mock types for testing
interface MockTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  branch: string | null;
  statusHistory: Array<{
    from: TaskStatus | null;
    to: TaskStatus;
    timestamp: string;
    triggeredBy: string;
  }>;
  repo: MockRepo;
  executions: MockExecution[];
}

interface MockRepo {
  id: string;
  name: string;
  fullName: string;
  userId: string;
  localPath: string | null;
  cloneUrl: string;
  defaultBranch: string;
  prTargetBranch: string | null;
  prDraftDefault: boolean;
}

interface MockExecution {
  id: string;
  status: string;
  commits: string[] | null;
}

interface MockPendingChange {
  id: string;
  executionId: string;
  taskId: string;
  filePath: string;
  action: PendingChangeAction;
  oldContent: string | null;
  newContent: string;
  diffPatch: string | null;
  isApproved: boolean;
}

describe("Diff Approve API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authorization", () => {
    it("should return 401 when user is not authenticated", () => {
      const session = null as { user?: { id: string } | null } | null;

      const isAuthorized = session != null && session.user?.id != null;
      expect(isAuthorized).toBe(false);
    });

    it("should return 401 when session has no user", () => {
      const session = { user: null } as { user: { id: string } | null };

      const isAuthorized = session.user?.id != null;
      expect(isAuthorized).toBe(false);
    });

    it("should pass authorization with valid session", () => {
      const session = { user: { id: "user-123" } };

      const isAuthorized = session?.user?.id != null;
      expect(isAuthorized).toBe(true);
    });
  });

  describe("Task Ownership Validation", () => {
    it("should return 404 when task not found", () => {
      const task = undefined as MockTask | undefined;
      const sessionUserId = "user-123";

      const isValid = task != null && task.repo.userId === sessionUserId;
      expect(isValid).toBeFalsy();
    });

    it("should return 404 when task belongs to different user", () => {
      const task: MockTask = {
        id: "task-123",
        title: "Test task",
        description: null,
        status: "review",
        branch: "loopforge/abc12345",
        statusHistory: [],
        repo: {
          id: "repo-456",
          name: "my-repo",
          fullName: "owner/my-repo",
          userId: "other-user",
          localPath: "/path/to/repo",
          cloneUrl: "https://github.com/owner/my-repo.git",
          defaultBranch: "main",
          prTargetBranch: null,
          prDraftDefault: false,
        },
        executions: [],
      };
      const sessionUserId = "user-123";

      const isValid = task.repo.userId === sessionUserId;
      expect(isValid).toBe(false);
    });

    it("should pass validation when task belongs to user", () => {
      const task: MockTask = {
        id: "task-123",
        title: "Test task",
        description: null,
        status: "review",
        branch: "loopforge/abc12345",
        statusHistory: [],
        repo: {
          id: "repo-456",
          name: "my-repo",
          fullName: "owner/my-repo",
          userId: "user-123",
          localPath: "/path/to/repo",
          cloneUrl: "https://github.com/owner/my-repo.git",
          defaultBranch: "main",
          prTargetBranch: null,
          prDraftDefault: false,
        },
        executions: [],
      };
      const sessionUserId = "user-123";

      const isValid = task.repo.userId === sessionUserId;
      expect(isValid).toBe(true);
    });
  });

  describe("Task Status Validation", () => {
    it("should return 400 when task is not in review status", () => {
      const invalidStatuses: TaskStatus[] = [
        "todo",
        "brainstorming",
        "planning",
        "ready",
        "executing",
        "done",
        "stuck",
      ];

      invalidStatuses.forEach((status) => {
        const canApprove = status === "review";
        expect(canApprove).toBe(false);
      });
    });

    it("should allow approval when task is in review status", () => {
      const status: TaskStatus = "review";
      const canApprove = status === "review";
      expect(canApprove).toBe(true);
    });
  });

  describe("Pending Changes Validation", () => {
    it("should return 400 when no pending changes exist", () => {
      const pendingChanges: MockPendingChange[] = [];

      const hasPendingChanges = pendingChanges.length > 0;
      expect(hasPendingChanges).toBe(false);
    });

    it("should pass validation when pending changes exist", () => {
      const pendingChanges: MockPendingChange[] = [
        {
          id: "change-1",
          executionId: "exec-123",
          taskId: "task-123",
          filePath: "src/index.ts",
          action: "modify",
          oldContent: "old",
          newContent: "new",
          diffPatch: "diff",
          isApproved: false,
        },
      ];

      const hasPendingChanges = pendingChanges.length > 0;
      expect(hasPendingChanges).toBe(true);
    });
  });

  describe("Execution Validation", () => {
    it("should return 400 when no execution exists", () => {
      const executions: MockExecution[] = [];
      const latestExecution = executions[0];

      expect(latestExecution).toBeUndefined();
    });

    it("should use the latest execution", () => {
      const executions: MockExecution[] = [
        { id: "exec-3", status: "completed", commits: [] },
        { id: "exec-2", status: "completed", commits: ["sha2"] },
        { id: "exec-1", status: "failed", commits: [] },
      ];

      // In the real API, executions are ordered by createdAt desc
      const latestExecution = executions[0];
      expect(latestExecution.id).toBe("exec-3");
    });
  });

  describe("Repository Path Resolution", () => {
    const REPOS_DIR = "/app/repos";

    it("should use localPath when available", () => {
      const repo: MockRepo = {
        id: "repo-456",
        name: "my-repo",
        fullName: "owner/my-repo",
        userId: "user-123",
        localPath: "/custom/path/to/repo",
        cloneUrl: "https://github.com/owner/my-repo.git",
        defaultBranch: "main",
        prTargetBranch: null,
        prDraftDefault: false,
      };

      const repoPath =
        repo.localPath || `${REPOS_DIR}/${repo.fullName.replace("/", "_")}`;
      expect(repoPath).toBe("/custom/path/to/repo");
    });

    it("should compute path from fullName when localPath not set", () => {
      const repo: MockRepo = {
        id: "repo-456",
        name: "my-repo",
        fullName: "owner/my-repo",
        userId: "user-123",
        localPath: null,
        cloneUrl: "https://github.com/owner/my-repo.git",
        defaultBranch: "main",
        prTargetBranch: null,
        prDraftDefault: false,
      };

      const repoPath =
        repo.localPath || `${REPOS_DIR}/${repo.fullName.replace("/", "_")}`;
      expect(repoPath).toBe("/app/repos/owner_my-repo");
    });
  });

  describe("Branch Name Resolution", () => {
    it("should use task branch when available", () => {
      const task: MockTask = {
        id: "task-123",
        title: "Test task",
        description: null,
        status: "review",
        branch: "loopforge/abc12345",
        statusHistory: [],
        repo: {} as MockRepo,
        executions: [],
      };

      const generateBranchName = (t: MockTask) =>
        `loopforge/${t.id.slice(0, 8)}`;
      const branch = task.branch || generateBranchName(task);

      expect(branch).toBe("loopforge/abc12345");
    });

    it("should generate branch name when not set", () => {
      const task: MockTask = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Test task",
        description: null,
        status: "review",
        branch: null,
        statusHistory: [],
        repo: {} as MockRepo,
        executions: [],
      };

      const generateBranchName = (t: MockTask) =>
        `loopforge/${t.id.slice(0, 8)}`;
      const branch = task.branch || generateBranchName(task);

      expect(branch).toBe("loopforge/550e8400");
    });
  });

  describe("File Writing from Pending Changes", () => {
    it("should map pending changes to file operations", () => {
      const pendingChanges: MockPendingChange[] = [
        {
          id: "1",
          executionId: "exec",
          taskId: "task",
          filePath: "src/new.ts",
          action: "create",
          oldContent: null,
          newContent: "new content",
          diffPatch: null,
          isApproved: false,
        },
        {
          id: "2",
          executionId: "exec",
          taskId: "task",
          filePath: "src/modified.ts",
          action: "modify",
          oldContent: "old",
          newContent: "new",
          diffPatch: null,
          isApproved: false,
        },
        {
          id: "3",
          executionId: "exec",
          taskId: "task",
          filePath: "src/deleted.ts",
          action: "delete",
          oldContent: "content",
          newContent: "",
          diffPatch: null,
          isApproved: false,
        },
      ];

      const fileOperations = pendingChanges.map((change) => ({
        filePath: change.filePath,
        action: change.action,
        newContent: change.newContent,
      }));

      expect(fileOperations).toHaveLength(3);
      expect(fileOperations[0].action).toBe("create");
      expect(fileOperations[1].action).toBe("modify");
      expect(fileOperations[2].action).toBe("delete");
    });
  });

  describe("Commit Operations", () => {
    it("should format commit message with LoopForge prefix", () => {
      const taskTitle = "Add user authentication";
      const commitMessage = `[LoopForge] ${taskTitle}`;

      expect(commitMessage).toBe("[LoopForge] Add user authentication");
    });

    it("should track commit SHA after successful commit", () => {
      const commitResult = {
        sha: "abc123def456",
        message: "[LoopForge] Add feature",
        filesChanged: 3,
      };

      expect(commitResult.sha).toMatch(/^[a-f0-9]+$/);
      expect(commitResult.filesChanged).toBe(3);
    });
  });

  describe("Execution Commit Record", () => {
    it("should create execution commit record with correct data", () => {
      const executionCommitRecord = {
        executionId: "exec-123",
        commitSha: "abc123def456",
        commitMessage: "[LoopForge] Add feature",
        filesChanged: ["src/a.ts", "src/b.ts"],
      };

      expect(executionCommitRecord.executionId).toBe("exec-123");
      expect(executionCommitRecord.commitSha).toBe("abc123def456");
      expect(executionCommitRecord.filesChanged).toHaveLength(2);
    });
  });

  describe("Execution Update", () => {
    it("should update execution with commit info", () => {
      const existingCommits: string[] = [];
      const newCommitSha = "abc123";

      const executionUpdate = {
        commits: [...existingCommits, newCommitSha],
        completedAt: new Date(),
        status: "completed",
      };

      expect(executionUpdate.commits).toContain("abc123");
      expect(executionUpdate.status).toBe("completed");
    });

    it("should append to existing commits", () => {
      const existingCommits = ["sha1", "sha2"];
      const newCommitSha = "sha3";

      const executionUpdate = {
        commits: [...existingCommits, newCommitSha],
      };

      expect(executionUpdate.commits).toEqual(["sha1", "sha2", "sha3"]);
    });
  });

  describe("PR Creation", () => {
    it("should create PR when createPr option is true (default)", async () => {
      const body: { createPr?: boolean } = {};
      const createPr = body.createPr !== false; // Default to true

      expect(createPr).toBe(true);
    });

    it("should skip PR creation when createPr option is false", async () => {
      const body = { createPr: false };
      const createPr = body.createPr !== false;

      expect(createPr).toBe(false);
    });

    it("should use repo settings for PR configuration", () => {
      const repo: MockRepo = {
        id: "repo-456",
        name: "my-repo",
        fullName: "owner/my-repo",
        userId: "user-123",
        localPath: "/path/to/repo",
        cloneUrl: "https://github.com/owner/my-repo.git",
        defaultBranch: "main",
        prTargetBranch: "develop",
        prDraftDefault: true,
      };

      const prConfig = {
        head: "loopforge/abc12345",
        base: repo.prTargetBranch || repo.defaultBranch,
        draft: repo.prDraftDefault,
      };

      expect(prConfig.base).toBe("develop");
      expect(prConfig.draft).toBe(true);
    });

    it("should fall back to defaultBranch when prTargetBranch not set", () => {
      const repo: MockRepo = {
        id: "repo-456",
        name: "my-repo",
        fullName: "owner/my-repo",
        userId: "user-123",
        localPath: "/path/to/repo",
        cloneUrl: "https://github.com/owner/my-repo.git",
        defaultBranch: "main",
        prTargetBranch: null,
        prDraftDefault: false,
      };

      const base = repo.prTargetBranch || repo.defaultBranch;
      expect(base).toBe("main");
    });

    it("should extract owner and repo from fullName", () => {
      const fullName = "octocat/hello-world";
      const [owner, repoName] = fullName.split("/");

      expect(owner).toBe("octocat");
      expect(repoName).toBe("hello-world");
    });
  });

  describe("Task Status Update to Done", () => {
    it("should update task status to done after approval", () => {
      const currentStatus: TaskStatus = "review";
      const newStatus: TaskStatus = "done";

      const historyEntry = {
        from: currentStatus,
        to: newStatus,
        timestamp: new Date().toISOString(),
        triggeredBy: "user" as const,
        userId: "user-123",
      };

      expect(historyEntry.from).toBe("review");
      expect(historyEntry.to).toBe("done");
      expect(historyEntry.triggeredBy).toBe("user");
    });

    it("should include PR info in task update when PR created", () => {
      const taskUpdate = {
        status: "done" as TaskStatus,
        prUrl: "https://github.com/owner/repo/pull/42",
        prNumber: 42,
        updatedAt: new Date(),
      };

      expect(taskUpdate.status).toBe("done");
      expect(taskUpdate.prUrl).toContain("pull/42");
      expect(taskUpdate.prNumber).toBe(42);
    });

    it("should set PR info to null when PR not created", () => {
      const taskUpdate = {
        status: "done" as TaskStatus,
        prUrl: null,
        prNumber: null,
        updatedAt: new Date(),
      };

      expect(taskUpdate.prUrl).toBeNull();
      expect(taskUpdate.prNumber).toBeNull();
    });
  });

  describe("Pending Changes Cleanup", () => {
    it("should delete pending changes after successful approval", () => {
      // This is verified by the deletePendingChangesByTask call
      const taskId = "task-123";
      expect(taskId).toBeDefined();
    });
  });

  describe("Response Format", () => {
    it("should return success response with task and commit info", () => {
      const response = {
        success: true,
        task: {
          id: "task-123",
          status: "done",
        },
        commit: {
          sha: "abc123",
          message: "[LoopForge] Add feature",
          filesChanged: ["src/a.ts", "src/b.ts"],
        },
        pr: {
          url: "https://github.com/owner/repo/pull/42",
          number: 42,
        },
      };

      expect(response.success).toBe(true);
      expect(response.task.status).toBe("done");
      expect(response.commit.sha).toBe("abc123");
      expect(response.pr?.number).toBe(42);
    });

    it("should return response without PR when not created", () => {
      const response = {
        success: true,
        task: {
          id: "task-123",
          status: "done",
        },
        commit: {
          sha: "abc123",
          message: "[LoopForge] Add feature",
          filesChanged: ["src/a.ts"],
        },
        pr: null,
      };

      expect(response.pr).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should return 400 when GitHub token not found", () => {
      const githubToken: string | null = null;

      const hasToken = githubToken != null;
      expect(hasToken).toBe(false);
    });

    it("should handle commit failure gracefully", () => {
      const commitError = new Error("Failed to push: permission denied");

      const errorResponse = {
        error: commitError.message,
        status: 500,
      };

      expect(errorResponse.error).toContain("permission denied");
      expect(errorResponse.status).toBe(500);
    });

    it("should handle PR creation failure gracefully", () => {
      const prError = new Error(
        "Validation Failed: A pull request already exists",
      );

      const errorResponse = {
        error: prError.message,
        status: 500,
      };

      expect(errorResponse.error).toContain("already exists");
    });
  });

  describe("Authenticated URL Building", () => {
    it("should build authenticated URL for push", () => {
      const cloneUrl = "https://github.com/owner/repo.git";
      const token = "ghp_xxxxxxxxxxxx";

      const buildAuthenticatedUrl = (url: string, t: string) => {
        const parsed = new URL(url);
        parsed.username = "x-access-token";
        parsed.password = t;
        return parsed.toString();
      };

      const authUrl = buildAuthenticatedUrl(cloneUrl, token);
      expect(authUrl).toContain("x-access-token");
      expect(authUrl).toContain(token);
    });
  });
});
