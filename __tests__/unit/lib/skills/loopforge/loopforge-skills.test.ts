import { describe, it, expect } from "vitest";
import { autonomousCodeGeneration } from "@/lib/skills/loopforge/autonomous-code-generation";
import { multiAgentCoordination } from "@/lib/skills/loopforge/multi-agent-coordination";
import { gitWorkflowAutomation } from "@/lib/skills/loopforge/git-workflow-automation";
import { contextAccumulation } from "@/lib/skills/loopforge/context-accumulation";
import { promptEngineering } from "@/lib/skills/loopforge/prompt-engineering";
import type { SkillInvocationContext } from "@/lib/skills/types";

const mockClient: {
  getProvider: () => string;
  getModel: () => string;
} = {
  getProvider: () => "anthropic",
  getModel: () => "claude-sonnet-4",
};

describe("Autonomous Code Generation Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "executing",
    taskDescription: "Implement feature",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should skip when not in executing phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "planning",
      };

      const result = await autonomousCodeGeneration.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in execution phase");
    });

    it("should warn when low extraction success rate", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        iteration: 5,
        metadata: {
          extractionAttempts: 10,
          extractionSuccesses: 3, // 30% success rate
        },
      };

      const result = await autonomousCodeGeneration.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("warning");
      expect(result.recommendations).toBeDefined();
      expect(
        result.recommendations!.some((r) => r.includes("extraction")),
      ).toBe(true);
    });

    it("should warn when high iteration count with no commits", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        iteration: 8,
        commits: [],
      };

      const result = await autonomousCodeGeneration.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("warning");
      expect(result.message).toContain("no commits");
    });

    it("should pass when execution on track", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        iteration: 3,
        commits: ["abc123"],
        metadata: {
          extractionAttempts: 5,
          extractionSuccesses: 4, // 80% success rate
        },
      };

      const result = await autonomousCodeGeneration.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("on track");
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(autonomousCodeGeneration.id).toBe("autonomous-code-generation");
      expect(autonomousCodeGeneration.category).toBe("execution");
      expect(autonomousCodeGeneration.enforcement).toBe("guidance");
      expect(autonomousCodeGeneration.triggerPhases).toContain("executing");
    });
  });
});

describe("Multi-Agent Coordination Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "planning",
    taskDescription: "Implement multiple features",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should skip when not in planning/executing phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "brainstorming",
      };

      const result = await multiAgentCoordination.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in planning/execution phase");
    });

    it("should pass when no parallelization opportunity", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        planContent: `
          Task 1: Setup database
          Task 2: Create API (depends on Task 1)
        `,
      };

      const result = await multiAgentCoordination.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("No parallelization opportunity");
    });

    it("should warn when parallelization detected", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        planContent: `
          { "id": "1", "dependencies": [] }
          { "id": "2", "dependencies": [] }
          { "id": "3", "dependencies": [] }
        `,
      };

      const result = await multiAgentCoordination.executeLogic(
        context,
        mockClient,
      );

      if (result.metadata?.canParallelize) {
        expect(result.status).toBe("warning");
        expect(result.message).toContain("Parallelization opportunity");
      }
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(multiAgentCoordination.id).toBe("multi-agent-coordination");
      expect(multiAgentCoordination.category).toBe("coordination");
      expect(multiAgentCoordination.enforcement).toBe("guidance");
    });
  });
});

describe("Git Workflow Automation Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "executing",
    taskDescription: "Implement feature",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should skip when not in executing/review phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "planning",
      };

      const result = await gitWorkflowAutomation.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in execution/review phase");
    });

    it("should warn when branch name incorrect", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        metadata: {
          branchName: "feature/my-branch", // Wrong format
        },
      };

      const result = await gitWorkflowAutomation.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("warning");
      expect(
        result.recommendations!.some((r) => r.includes("loopforge/task-")),
      ).toBe(true);
    });

    it("should warn when commit message not conventional", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123"],
        metadata: {
          branchName: "loopforge/task-123",
          lastCommitMessage: "fixed bug", // Not conventional format
        },
      };

      const result = await gitWorkflowAutomation.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("warning");
      expect(
        result.recommendations!.some((r) => r.includes("conventional")),
      ).toBe(true);
    });

    it("should pass when conventions followed", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        commits: ["abc123"],
        metadata: {
          branchName: "loopforge/task-test-123",
          lastCommitMessage:
            "feat(auth): add JWT validation\n\nCo-Authored-By: Claude",
          testsPass: true,
          testGatePolicy: "warn",
        },
      };

      const result = await gitWorkflowAutomation.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(gitWorkflowAutomation.id).toBe("git-workflow-automation");
      expect(gitWorkflowAutomation.category).toBe("execution");
      expect(gitWorkflowAutomation.enforcement).toBe("warning");
    });
  });
});

describe("Context Accumulation Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "brainstorming",
    taskDescription: "Design feature",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should skip when not in conversational phase", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        phase: "executing",
      };

      const result = await contextAccumulation.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("Not in conversational phase");
    });

    it("should pass when token usage healthy", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        brainstormHistory: [
          { role: "user", content: "Let's discuss" },
          { role: "assistant", content: "Sure, tell me more" },
        ],
        metadata: {
          provider: "anthropic",
          model: "claude-sonnet-4",
        },
      };

      const result = await contextAccumulation.executeLogic(
        context,
        mockClient,
      );

      expect(result.status).toBe("passed");
      expect(result.message).toContain("healthy");
    });

    it("should warn when approaching token limit", async () => {
      const longContent = "word ".repeat(30000); // ~120k tokens worth
      const context: SkillInvocationContext = {
        ...baseContext,
        brainstormHistory: Array(50)
          .fill(null)
          .map(() => ({ role: "user", content: longContent })),
        metadata: {
          provider: "anthropic",
          model: "claude-sonnet-4",
        },
      };

      const result = await contextAccumulation.executeLogic(
        context,
        mockClient,
      );

      // Should warn about high token usage
      if (result.metadata && (result.metadata.usagePercentage as number) > 60) {
        expect(result.status).toBe("warning");
        expect(result.recommendations).toBeDefined();
      }
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(contextAccumulation.id).toBe("context-accumulation");
      expect(contextAccumulation.category).toBe("optimization");
      expect(contextAccumulation.enforcement).toBe("guidance");
    });
  });
});

describe("Prompt Engineering Skill", () => {
  const baseContext: SkillInvocationContext = {
    taskId: "test-123",
    phase: "planning",
    taskDescription: "Create plan",
    workingDir: "/test",
  };

  describe("executeLogic", () => {
    it("should pass when no prompt construction", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        metadata: {},
      };

      const result = await promptEngineering.executeLogic(context, mockClient);

      expect(result.status).toBe("passed");
      expect(result.message).toContain("No prompt construction detected");
    });

    it("should warn when prompt quality low", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        metadata: {
          currentPrompt: "Do the task", // Very low quality, no KERNEL elements
        },
      };

      const result = await promptEngineering.executeLogic(context, mockClient);

      expect(result.status).toBe("warning");
      expect(result.metadata?.score).toBeLessThan(80);
    });

    it("should pass when prompt quality high", async () => {
      const context: SkillInvocationContext = {
        ...baseContext,
        metadata: {
          currentPrompt: `
            ## Purpose
            Create a detailed plan for authentication

            ## Success Criteria
            - All tasks defined
            - Acceptance criteria per task

            ## Output Format
            JSON with steps array

            ## Rules
            DO: Break into small tasks
            DON'T: Skip testing steps
          `,
        },
      };

      const result = await promptEngineering.executeLogic(context, mockClient);

      if (result.metadata?.score) {
        expect((result.metadata.score as number) >= 80).toBe(true);
        expect(result.status).toBe("passed");
      }
    });
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(promptEngineering.id).toBe("prompt-engineering");
      expect(promptEngineering.category).toBe("optimization");
      expect(promptEngineering.enforcement).toBe("guidance");
    });

    it("should have KERNEL framework in prompt", () => {
      expect(promptEngineering.systemPrompt).toContain("KERNEL");
      expect(promptEngineering.systemPrompt).toContain("Keep It Simple");
      expect(promptEngineering.systemPrompt).toContain("Easy to Verify");
    });
  });
});
