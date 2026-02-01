import { describe, it, expect } from "vitest";
import { generatePrompt, type PromptContext } from "@/lib/ralph/prompt-generator";
import { RALPH_COMPLETE, RALPH_STUCK } from "@/lib/ralph/types";

describe("Ralph Module", () => {
  describe("Prompt Generator", () => {
    const baseContext: PromptContext = {
      project: "test-project",
      changeId: "add-feature",
      iteration: 1,
      workingDir: "src",
      tasksPath: "src/tasks.md",
      quickVerify: "npm run typecheck",
      fullVerify: "npm run test",
      doConstraints: ["Follow existing patterns", "Write tests"],
      dontConstraints: ["Don't break existing functionality"],
    };

    it("should generate a valid prompt with all context", () => {
      const prompt = generatePrompt(baseContext);

      expect(prompt).toContain("# Ralph Loop - Iteration 1");
      expect(prompt).toContain("Project: test-project");
      expect(prompt).toContain("Change: add-feature");
      expect(prompt).toContain("Working directory: src");
      expect(prompt).toContain("Tasks file: src/tasks.md");
      expect(prompt).toContain("npm run typecheck");
      expect(prompt).toContain("npm run test");
      expect(prompt).toContain("Follow existing patterns");
      expect(prompt).toContain("Write tests");
      expect(prompt).toContain("Don't break existing functionality");
    });

    it("should include RALPH_COMPLETE instruction", () => {
      const prompt = generatePrompt(baseContext);
      expect(prompt).toContain("RALPH_COMPLETE");
    });

    it("should include RALPH_STUCK instruction", () => {
      const prompt = generatePrompt(baseContext);
      expect(prompt).toContain("RALPH_STUCK");
    });

    it("should update iteration number correctly", () => {
      const context5 = { ...baseContext, iteration: 5 };
      const prompt = generatePrompt(context5);
      expect(prompt).toContain("# Ralph Loop - Iteration 5");
    });

    it("should include all do constraints", () => {
      const context = {
        ...baseContext,
        doConstraints: ["Constraint 1", "Constraint 2", "Constraint 3"],
      };
      const prompt = generatePrompt(context);

      expect(prompt).toContain("- Constraint 1");
      expect(prompt).toContain("- Constraint 2");
      expect(prompt).toContain("- Constraint 3");
    });

    it("should include all dont constraints", () => {
      const context = {
        ...baseContext,
        dontConstraints: ["Never do A", "Never do B"],
      };
      const prompt = generatePrompt(context);

      expect(prompt).toContain("- Never do A");
      expect(prompt).toContain("- Never do B");
    });
  });

  describe("Constants", () => {
    it("should have correct RALPH_COMPLETE value", () => {
      expect(RALPH_COMPLETE).toBe("RALPH_COMPLETE");
    });

    it("should have correct RALPH_STUCK value", () => {
      expect(RALPH_STUCK).toBe("RALPH_STUCK");
    });
  });
});
