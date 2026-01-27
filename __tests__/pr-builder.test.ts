import { describe, it, expect } from "vitest";
import {
  buildPRContent,
  buildSimplePRContent,
  buildRollbackPRComment,
} from "@/lib/github/pr-builder";
import type { Task, Repo, Execution, TestRun } from "@/lib/db/schema";

// Helper to create mock task
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-123",
    repoId: "repo-123",
    title: "Add user authentication",
    description: "Implement OAuth2 login with GitHub",
    status: "done",
    priority: 0,
    brainstormResult: null,
    planContent: JSON.stringify({
      overview: "Implementation overview",
      steps: [
        {
          id: "1",
          title: "Setup OAuth",
          description: "Configure OAuth provider",
        },
        { id: "2", title: "Add login page", description: "Create login UI" },
      ],
      verification: ["Test login flow", "Verify token storage"],
    }),
    branch: "feature/auth",
    prNumber: null,
    prUrl: null,
    prTargetBranch: null,
    prDraft: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Task;
}

// Helper to create mock repo
function createMockRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: "repo-123",
    userId: "user-123",
    githubRepoId: "gh-123",
    name: "my-repo",
    fullName: "user/my-repo",
    defaultBranch: "main",
    cloneUrl: "https://github.com/user/my-repo.git",
    isPrivate: false,
    prTitleTemplate: null,
    prTargetBranch: null,
    prDraftDefault: false,
    prReviewers: null,
    prLabels: null,
    testCommand: null,
    testTimeout: null,
    testsEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Repo;
}

describe("PR Builder", () => {
  describe("buildPRContent", () => {
    it("should build basic PR content", () => {
      const task = createMockTask();
      const repo = createMockRepo();

      const result = buildPRContent({ task, repo });

      expect(result.title).toContain("Add user authentication");
      expect(result.body).toContain("## Summary");
      expect(result.body).toContain("Add user authentication");
      expect(result.head).toBe("feature/auth");
      expect(result.base).toBe("main");
      expect(result.draft).toBe(false);
    });

    it("should use custom title template", () => {
      const task = createMockTask();
      const repo = createMockRepo({
        prTitleTemplate: "feat: {{title}} ({{taskId}})",
      });

      const result = buildPRContent({ task, repo });

      expect(result.title).toContain("feat:");
      expect(result.title).toContain("Add user authentication");
      expect(result.title).toContain("task-123".slice(0, 8));
    });

    it("should include implementation steps from plan", () => {
      const task = createMockTask();
      const repo = createMockRepo();

      const result = buildPRContent({ task, repo });

      expect(result.body).toContain("## Implementation Steps");
      expect(result.body).toContain("Setup OAuth");
      expect(result.body).toContain("Add login page");
    });

    it("should include files changed", () => {
      const task = createMockTask();
      const repo = createMockRepo();

      const result = buildPRContent({
        task,
        repo,
        filesChanged: ["src/auth.ts", "src/login.tsx", "lib/oauth.ts"],
      });

      expect(result.body).toContain("## Files Changed");
      expect(result.body).toContain("3 file(s) modified");
      expect(result.body).toContain("src/auth.ts");
    });

    it("should include execution details", () => {
      const task = createMockTask();
      const repo = createMockRepo();
      const execution: Partial<Execution> = {
        id: "exec-123",
        taskId: "task-123",
        status: "completed",
        iteration: 5,
        startedAt: new Date("2024-01-01T10:00:00Z"),
        completedAt: new Date("2024-01-01T10:05:00Z"),
        createdAt: new Date(),
      };

      const result = buildPRContent({
        task,
        repo,
        execution: execution as Execution,
      });

      expect(result.body).toContain("## Execution Details");
      expect(result.body).toContain("5");
    });

    it("should include test results when passed", () => {
      const task = createMockTask();
      const repo = createMockRepo();
      const testRun: Partial<TestRun> = {
        id: "test-123",
        executionId: "exec-123",
        taskId: "task-123",
        status: "passed",
        command: "npm test",
        durationMs: 5000,
        exitCode: 0,
        stdout: "All tests passed",
        stderr: null,
        completedAt: new Date(),
        createdAt: new Date(),
      };

      const result = buildPRContent({
        task,
        repo,
        testRun: testRun as TestRun,
      });

      expect(result.body).toContain("## Test Results");
      expect(result.body).toContain("Tests passed");
    });

    it("should include test failure details", () => {
      const task = createMockTask();
      const repo = createMockRepo();
      const testRun: Partial<TestRun> = {
        id: "test-123",
        executionId: "exec-123",
        taskId: "task-123",
        status: "failed",
        command: "npm test",
        durationMs: 3000,
        exitCode: 1,
        stdout: "1 test failed",
        stderr: "Error: assertion failed",
        completedAt: new Date(),
        createdAt: new Date(),
      };

      const result = buildPRContent({
        task,
        repo,
        testRun: testRun as TestRun,
      });

      expect(result.body).toContain("Tests failed");
      expect(result.body).toContain("Error output");
    });

    it("should include verification checklist from plan", () => {
      const task = createMockTask();
      const repo = createMockRepo();

      const result = buildPRContent({ task, repo });

      expect(result.body).toContain("## Verification Checklist");
      expect(result.body).toContain("Test login flow");
    });

    it("should respect PR configuration from repo", () => {
      const task = createMockTask();
      const repo = createMockRepo({
        prTargetBranch: "develop",
        prDraftDefault: true,
        prReviewers: ["reviewer1", "reviewer2"],
        prLabels: ["enhancement", "ai-generated"],
      });

      const result = buildPRContent({ task, repo });

      expect(result.base).toBe("develop");
      expect(result.draft).toBe(true);
      expect(result.reviewers).toEqual(["reviewer1", "reviewer2"]);
      expect(result.labels).toEqual(["enhancement", "ai-generated"]);
    });

    it("should allow task to override PR target branch", () => {
      const task = createMockTask({ prTargetBranch: "staging" });
      const repo = createMockRepo({ prTargetBranch: "develop" });

      const result = buildPRContent({ task, repo });

      expect(result.base).toBe("staging");
    });
  });

  describe("buildSimplePRContent", () => {
    it("should build simple PR content", () => {
      const task = createMockTask();
      const repo = createMockRepo();

      const result = buildSimplePRContent(task, repo);

      expect(result.title).toContain("Add user authentication");
      expect(result.body).toContain("## Summary");
      expect(result.body).toContain("LoopForge Studio");
    });
  });

  describe("buildRollbackPRComment", () => {
    it("should build rollback comment", () => {
      const comment = buildRollbackPRComment("abc1234", "def5678");

      expect(comment).toContain("## Rollback Notice");
      expect(comment).toContain("abc1234");
      expect(comment).toContain("def5678");
      expect(comment).toContain("reverted");
    });

    it("should include reason when provided", () => {
      const comment = buildRollbackPRComment(
        "abc1234",
        "def5678",
        "Tests failing in CI",
      );

      expect(comment).toContain("Reason:");
      expect(comment).toContain("Tests failing in CI");
    });
  });
});
