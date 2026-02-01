import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { tasks, executions, repos, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { invokePhaseSkills, persistSkillExecution } from "@/lib/skills";
import type { SkillInvocationContext, SkillExecution } from "@/lib/skills/types";
import { pool } from "@/__tests__/setup/test-db";

const mockClient: any = {
  getProvider: () => "anthropic",
  getModel: () => "claude-sonnet-4",
  chat: async () => ({ content: "Mock response" }),
};

describe("Skill Enforcement End-to-End", () => {
  let testUserId: string;
  let testRepoId: string;
  let testTaskId: string;
  let testExecutionId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        githubId: 999999,
        login: "test-user",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: "https://example.com/avatar.jpg",
        accessToken: "encrypted-token",
      })
      .returning();

    testUserId = user.id;

    // Create test repo
    const [repo] = await db
      .insert(repos)
      .values({
        userId: testUserId,
        githubId: 888888,
        name: "test-repo",
        fullName: "test-user/test-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/test-user/test-repo.git",
        isPrivate: false,
        localPath: "/tmp/test-repo",
      })
      .returning();

    testRepoId = repo.id;

    // Create test task
    const [task] = await db
      .insert(tasks)
      .values({
        userId: testUserId,
        repoId: testRepoId,
        title: "Implement user authentication",
        description: "Add JWT-based authentication to the API",
        status: "todo",
      })
      .returning();

    testTaskId = task.id;

    // Create test execution
    const [execution] = await db
      .insert(executions)
      .values({
        taskId: testTaskId,
        status: "pending",
        skillExecutions: [],
      })
      .returning();

    testExecutionId = execution.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testExecutionId) {
      await db.delete(executions).where(eq(executions.id, testExecutionId));
    }
    if (testTaskId) {
      await db.delete(tasks).where(eq(tasks.id, testTaskId));
    }
    if (testRepoId) {
      await db.delete(repos).where(eq(repos.id, testRepoId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe("Database Persistence", () => {
    it("should persist skill executions to database", async () => {
      const context: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "brainstorming",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        brainstormHistory: [{ role: "user", content: "Let's build auth" }],
      };

      const results = await invokePhaseSkills("brainstorming", context, mockClient);

      // Persist each skill execution
      for (const result of results) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Verify database contains skill executions
      const [execution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, testExecutionId));

      expect(execution.skillExecutions).toBeDefined();
      expect(execution.skillExecutions.length).toBeGreaterThan(0);

      const brainstormExecution = execution.skillExecutions.find(
        (se: SkillExecution) => se.skillId === "brainstorming"
      );

      expect(brainstormExecution).toBeDefined();
      expect(brainstormExecution.status).toBe("warning");
      expect(brainstormExecution.timestamp).toBeDefined();
    });

    it("should accumulate skill executions across multiple invocations", async () => {
      const brainstormContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "brainstorming",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        brainstormHistory: [
          { role: "user", content: "Add authentication" },
          { role: "assistant", content: "Acceptance criteria defined" },
        ],
      };

      const brainstormResults = await invokePhaseSkills(
        "brainstorming",
        brainstormContext,
        mockClient
      );

      for (const result of brainstormResults) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Simulate moving to planning phase
      const planningContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "planning",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        planContent: "",
      };

      const planningResults = await invokePhaseSkills(
        "planning",
        planningContext,
        mockClient
      );

      for (const result of planningResults) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Verify both phases are persisted
      const [execution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, testExecutionId));

      const skillIds = execution.skillExecutions.map(
        (se: SkillExecution) => se.skillId
      );

      expect(skillIds).toContain("brainstorming");
      expect(skillIds).toContain("writing-plans");
      expect(execution.skillExecutions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Full Workflow Simulation", () => {
    it("should enforce skills through complete workflow", async () => {
      // Phase 1: Brainstorming
      await db
        .update(tasks)
        .set({ status: "brainstorming" })
        .where(eq(tasks.id, testTaskId));

      const brainstormContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "brainstorming",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        brainstormHistory: [
          { role: "user", content: "Add authentication" },
          { role: "assistant", content: "Acceptance criteria: users can log in" },
          { role: "user", content: "Implementation: auth service, JWT, tests" },
        ],
      };

      const brainstormResults = await invokePhaseSkills(
        "brainstorming",
        brainstormContext,
        mockClient
      );

      for (const result of brainstormResults) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Phase 2: Planning
      await db
        .update(tasks)
        .set({ status: "planning" })
        .where(eq(tasks.id, testTaskId));

      const planningContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "planning",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        planContent: `
          Step 1: Create auth service
          Step 2: Add login endpoint
          Step 3: Add JWT generation
          Step 4: Add tests
          Step 5: Update docs
        `,
      };

      const planningResults = await invokePhaseSkills(
        "planning",
        planningContext,
        mockClient
      );

      for (const result of planningResults) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Phase 3: Executing (with TDD blocking)
      await db
        .update(tasks)
        .set({ status: "executing" })
        .where(eq(tasks.id, testTaskId));

      const executingContext1: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "executing",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        modifiedFiles: ["src/auth/service.ts"],
        testHistory: [],
      };

      const executingResults1 = await invokePhaseSkills(
        "executing",
        executingContext1,
        mockClient
      );

      for (const result of executingResults1) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Should have blocked result
      const tddBlocked = executingResults1.find(
        (r) => r.skillId === "test-driven-development" && r.status === "blocked"
      );
      expect(tddBlocked).toBeDefined();

      // Phase 4: Executing (after adding test)
      const executingContext2: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "executing",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        modifiedFiles: ["src/auth/service.ts", "__tests__/auth/service.test.ts"],
        testHistory: [
          { status: "failed", timestamp: new Date("2026-01-29T10:00:00Z") },
          { status: "passed", timestamp: new Date("2026-01-29T10:05:00Z") },
        ],
        commits: ["abc123"],
      };

      const executingResults2 = await invokePhaseSkills(
        "executing",
        executingContext2,
        mockClient
      );

      for (const result of executingResults2) {
        await persistSkillExecution(testExecutionId, result);
      }

      // TDD should now pass
      const tddPassed = executingResults2.find(
        (r) => r.skillId === "test-driven-development" && r.status === "passed"
      );
      expect(tddPassed).toBeDefined();

      // Phase 5: Review
      await db
        .update(tasks)
        .set({ status: "review" })
        .where(eq(tasks.id, testTaskId));

      const reviewContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "review",
        taskDescription: "Add user authentication",
        workingDir: "/tmp/test-repo",
        planContent: "Modify src/auth/service.ts",
        commits: ["abc123", "def456"],
        testHistory: [{ status: "passed", timestamp: new Date() }],
      };

      const reviewResults = await invokePhaseSkills("review", reviewContext, mockClient);

      for (const result of reviewResults) {
        await persistSkillExecution(testExecutionId, result);
      }

      // Verification should pass
      const verifyPassed = reviewResults.find(
        (r) => r.skillId === "verification-before-completion"
      );
      expect(verifyPassed).toBeDefined();
      expect(["passed", "warning"]).toContain(verifyPassed?.status);

      // Verify complete workflow is persisted
      const [finalExecution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, testExecutionId));

      const uniqueSkills = new Set(
        finalExecution.skillExecutions.map((se: SkillExecution) => se.skillId)
      );

      expect(uniqueSkills.size).toBeGreaterThanOrEqual(5);
      expect(uniqueSkills.has("brainstorming")).toBe(true);
      expect(uniqueSkills.has("writing-plans")).toBe(true);
      expect(uniqueSkills.has("test-driven-development")).toBe(true);
      expect(uniqueSkills.has("verification-before-completion")).toBe(true);
    });
  });

  describe("Stuck Detection and Recovery", () => {
    it("should enforce systematic debugging when stuck", async () => {
      await db
        .update(tasks)
        .set({ status: "stuck" })
        .where(eq(tasks.id, testTaskId));

      const stuckContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "stuck",
        taskDescription: "Fix authentication bug",
        workingDir: "/tmp/test-repo",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
            metadata: { errorCount: 3 },
          },
        ],
        metadata: {},
      };

      const stuckResults = await invokePhaseSkills("stuck", stuckContext, mockClient);

      for (const result of stuckResults) {
        await persistSkillExecution(testExecutionId, result);
      }

      const debugBlocked = stuckResults.find(
        (r) => r.skillId === "systematic-debugging" && r.status === "blocked"
      );

      expect(debugBlocked).toBeDefined();
      expect(debugBlocked?.recommendations).toBeDefined();
      expect(debugBlocked?.recommendations?.length).toBeGreaterThan(0);

      // Verify stuck signal stored
      const [execution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, testExecutionId));

      const debugExecution = execution.skillExecutions.find(
        (se: SkillExecution) => se.skillId === "systematic-debugging"
      );

      expect(debugExecution).toBeDefined();
      expect(debugExecution.status).toBe("blocked");
    });

    it("should allow unstuck after investigation", async () => {
      const investigatedContext: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "stuck",
        taskDescription: "Fix authentication bug",
        workingDir: "/tmp/test-repo",
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            confidence: 0.95,
            evidence: "3 consecutive errors detected",
          },
        ],
        metadata: {
          errorAnalysis: "TypeError: Cannot read property 'id'",
          hypothesis: "User object not initialized",
          verification: "Added null check, tests pass",
        },
      };

      const results = await invokePhaseSkills("stuck", investigatedContext, mockClient);

      for (const result of results) {
        await persistSkillExecution(testExecutionId, result);
      }

      const debugPassed = results.find(
        (r) => r.skillId === "systematic-debugging" && r.status === "passed"
      );

      expect(debugPassed).toBeDefined();
    });
  });

  describe("Skill Metadata and Recommendations", () => {
    it("should store skill metadata in database", async () => {
      const context: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "planning",
        taskDescription: "Create feature",
        workingDir: "/tmp/test-repo",
        planContent: `
          Step 1: Do something
          Step 2: Do something else
        `,
      };

      const results = await invokePhaseSkills("planning", context, mockClient);

      for (const result of results) {
        await persistSkillExecution(testExecutionId, result);
      }

      const [execution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, testExecutionId));

      const planningExecution = execution.skillExecutions.find(
        (se: SkillExecution) => se.skillId === "writing-plans"
      );

      expect(planningExecution?.metadata).toBeDefined();
      if (planningExecution?.metadata?.granularityScore !== undefined) {
        expect(typeof planningExecution.metadata.granularityScore).toBe("number");
      }
    });

    it("should store recommendations for warnings", async () => {
      const context: SkillInvocationContext = {
        taskId: testTaskId,
        executionId: testExecutionId,
        phase: "executing",
        taskDescription: "Implement feature",
        workingDir: "/tmp/test-repo",
        iteration: 12,
        metadata: {
          extractionAttempts: 15,
          extractionSuccesses: 5,
        },
      };

      const results = await invokePhaseSkills("executing", context, mockClient);

      for (const result of results) {
        await persistSkillExecution(testExecutionId, result);
      }

      const [execution] = await db
        .select()
        .from(executions)
        .where(eq(executions.id, testExecutionId));

      // Find warning results
      const warnings = execution.skillExecutions.filter(
        (se: SkillExecution) => se.status === "warning"
      );

      if (warnings.length > 0) {
        const hasRecommendations = warnings.some(
          (w: SkillExecution) => w.metadata?.recommendations
        );
        expect(hasRecommendations).toBe(true);
      }
    });
  });

  describe("Feature Flag Compliance", () => {
    it("should respect ENABLE_SKILLS_SYSTEM flag", async () => {
      const originalFlag = process.env.ENABLE_SKILLS_SYSTEM;

      try {
        // Disable skills system
        process.env.ENABLE_SKILLS_SYSTEM = "false";

        const context: SkillInvocationContext = {
          taskId: testTaskId,
          executionId: testExecutionId,
          phase: "executing",
          taskDescription: "Test feature flags",
          workingDir: "/tmp/test-repo",
        };

        const results = await invokePhaseSkills("executing", context, mockClient);

        // Should return empty array when disabled
        expect(results).toEqual([]);
      } finally {
        // Restore original flag
        if (originalFlag !== undefined) {
          process.env.ENABLE_SKILLS_SYSTEM = originalFlag;
        } else {
          delete process.env.ENABLE_SKILLS_SYSTEM;
        }
      }
    });
  });
});
