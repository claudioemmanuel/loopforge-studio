import { describe, it, expect, vi } from "vitest";
import type { AIClient, ChatMessage, ChatOptions } from "@/lib/ai/client";

/** Creates a mock AIClient for testing */
function createMockAIClient(responseText: string): AIClient {
  return {
    chat: vi.fn().mockResolvedValue(responseText),
    getProvider: vi.fn().mockReturnValue("anthropic"),
    getModel: vi.fn().mockReturnValue("claude-sonnet-4-20250514"),
  };
}

describe("AI Module", () => {
  describe("Brainstorm", () => {
    it("should call AI client with correct parameters", async () => {
      const { brainstormTask } = await import("@/lib/ai/brainstorm");

      const mockResponse = JSON.stringify({
        summary: "Test summary",
        requirements: ["req1", "req2"],
        considerations: ["con1"],
        suggestedApproach: "Test approach",
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await brainstormTask(
        mockClient,
        "Add user authentication",
        "Implement OAuth2 login with GitHub"
      );

      expect(result).toBeDefined();
      expect(result.summary).toBe("Test summary");
      expect(result.requirements).toHaveLength(2);
      expect(result.considerations).toHaveLength(1);
      expect(result.suggestedApproach).toBe("Test approach");
      expect(mockClient.chat).toHaveBeenCalledTimes(1);
    });
  });

  describe("Plan Generation", () => {
    it("should generate a plan from brainstorm result", async () => {
      const { generatePlan } = await import("@/lib/ai/plan");

      const mockResponse = JSON.stringify({
        overview: "Implementation overview",
        steps: [
          { id: "1", title: "Step 1", description: "Do step 1" },
          { id: "2", title: "Step 2", description: "Do step 2" },
        ],
        verification: ["Verify step 1", "Verify step 2"],
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await generatePlan(
        mockClient,
        "Add user authentication",
        "Implement OAuth2 login",
        '{"summary": "test"}'
      );

      expect(result).toBeDefined();
      expect(result.overview).toBe("Implementation overview");
      expect(result.steps).toHaveLength(2);
      expect(result.verification).toHaveLength(2);
      expect(mockClient.chat).toHaveBeenCalledTimes(1);
    });
  });
});
