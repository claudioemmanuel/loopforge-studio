import { describe, expect, it, vi } from "vitest";
import { canTransitionPhase, getRecommendedSkills } from "@/lib/skills/invoker";
import type { SkillInvocationContext } from "@/lib/skills/types";

const mockClient = {} as never;

describe("skills phase transitions", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "task-1",
    phase: "planning",
    taskDescription: "Implement feature",
    workingDir: "/tmp/repo",
  };

  it("returns recommended skills for executing phase", () => {
    const skills = getRecommendedSkills("executing");
    expect(skills.length).toBeGreaterThan(0);
    expect(skills).toContain("test-driven-development");
  });

  it("evaluates transition allowance shape", async () => {
    const result = await canTransitionPhase(
      "planning",
      "executing",
      baseContext,
      mockClient,
    );

    expect(typeof result.allowed).toBe("boolean");
    if (!result.allowed) {
      expect(result.blockingSkill).toBeTruthy();
      expect(result.reason).toBeTruthy();
    }
  });

  it("allows transitions for phases without blocking skills", async () => {
    const result = await canTransitionPhase(
      "todo",
      "done",
      { ...baseContext, phase: "todo" },
      mockClient,
    );

    expect(result.allowed).toBe(true);
  });
});
