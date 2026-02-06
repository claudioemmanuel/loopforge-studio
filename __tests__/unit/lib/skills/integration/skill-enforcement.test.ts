import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  createSkillResultsSummary,
  getBlockingResults,
  hasBlockingResults,
  persistSkillExecution,
  skillResultToExecution,
} from "@/lib/skills/enforcement";
import type { SkillResult } from "@/lib/skills/types";
import { executions, repos, tasks, users } from "@/lib/db/schema";

describe("skill-enforcement", () => {
  let executionId: string;
  let taskId: string;
  let repoId: string;
  let userId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}-${Math.random()}`;

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      githubId: `gh-${unique}`,
      username: `user-${unique}`,
      email: `user-${unique}@example.com`,
    });

    repoId = randomUUID();
    await db.insert(repos).values({
      id: repoId,
      userId,
      githubRepoId: `repo-${unique}`,
      name: "skills-repo",
      fullName: `owner/skills-repo-${unique}`,
      cloneUrl: "https://github.com/owner/skills-repo.git",
      defaultBranch: "main",
    });

    taskId = randomUUID();
    await db.insert(tasks).values({
      id: taskId,
      repoId,
      title: "Skills Task",
      status: "executing",
    });

    executionId = randomUUID();
    await db.insert(executions).values({
      id: executionId,
      taskId,
      status: "running",
      iteration: 1,
    });
  });

  it("converts and summarizes skill results", () => {
    const results: SkillResult[] = [
      {
        skillId: "test-driven-development",
        status: "passed",
        message: "ok",
        timestamp: new Date(),
      },
      {
        skillId: "verification-before-completion",
        status: "blocked",
        message: "tests missing",
        timestamp: new Date(),
      },
    ];

    const execution = skillResultToExecution(results[0]);
    expect(execution.skillId).toBe("test-driven-development");
    expect(hasBlockingResults(results)).toBe(true);
    expect(getBlockingResults(results)).toHaveLength(1);
    expect(createSkillResultsSummary(results)).toContain("1 blocked");
  });

  it("persists skill execution history to execution row", async () => {
    await persistSkillExecution(executionId, {
      skillId: "systematic-debugging",
      status: "warning",
      message: "Retry with stricter diagnostics",
      recommendations: ["Collect traces"],
      timestamp: new Date(),
    });

    const row = await db.query.executions.findFirst({
      where: (table, { eq }) => eq(table.id, executionId),
    });

    expect(Array.isArray(row?.skillExecutions)).toBe(true);
    expect(row?.skillExecutions?.length).toBeGreaterThan(0);
    expect(row?.skillExecutions?.[0].skillId).toBe("systematic-debugging");
  });
});
