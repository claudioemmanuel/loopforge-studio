import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getConversation,
  setConversation,
  deleteConversation,
  initializeBrainstorm,
  type BrainstormConversation,
  type RepoContext,
  type ExistingBrainstormContext,
} from "@/lib/ai/brainstorm-chat";
import type { AIClient } from "@/lib/ai/client";

describe("brainstorm-chat", () => {
  beforeEach(() => {
    // Clear any existing conversations
    deleteConversation("test-task-1");
    deleteConversation("test-task-2");
  });

  describe("conversation store", () => {
    it("should store and retrieve conversation", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-1",
        messages: [{ role: "user", content: "Hello" }],
        repoContext: {
          techStack: ["Next.js"],
          fileStructure: ["app/"],
          configFiles: ["package.json"],
        },
      };

      setConversation("test-task-1", conversation);
      const retrieved = getConversation("test-task-1");

      expect(retrieved).toEqual(conversation);
    });

    it("should return undefined for non-existent conversation", () => {
      const result = getConversation("non-existent");
      expect(result).toBeUndefined();
    });

    it("should delete conversation", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-2",
        messages: [],
        repoContext: {
          techStack: [],
          fileStructure: [],
          configFiles: [],
        },
      };

      setConversation("test-task-2", conversation);
      expect(getConversation("test-task-2")).toBeDefined();

      deleteConversation("test-task-2");
      expect(getConversation("test-task-2")).toBeUndefined();
    });

    it("should update existing conversation", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-1",
        messages: [{ role: "user", content: "Hello" }],
        repoContext: {
          techStack: ["Next.js"],
          fileStructure: [],
          configFiles: [],
        },
      };

      setConversation("test-task-1", conversation);

      // Update with new message
      const updated: BrainstormConversation = {
        ...conversation,
        messages: [
          ...conversation.messages,
          { role: "assistant", content: "Hi there!" },
        ],
      };

      setConversation("test-task-1", updated);
      const retrieved = getConversation("test-task-1");

      expect(retrieved?.messages).toHaveLength(2);
      expect(retrieved?.messages[1].content).toBe("Hi there!");
    });

    it("should store conversation with preview", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-1",
        messages: [{ role: "user", content: "Hello" }],
        repoContext: {
          techStack: ["Next.js"],
          fileStructure: [],
          configFiles: [],
        },
        currentPreview: {
          summary: "Test summary",
          requirements: ["req1", "req2"],
          considerations: ["con1"],
          suggestedApproach: "Test approach",
        },
      };

      setConversation("test-task-1", conversation);
      const retrieved = getConversation("test-task-1");

      expect(retrieved?.currentPreview).toBeDefined();
      expect(retrieved?.currentPreview?.summary).toBe("Test summary");
      expect(retrieved?.currentPreview?.requirements).toHaveLength(2);
    });
  });

  describe("initializeBrainstorm", () => {
    const mockRepoContext: RepoContext = {
      techStack: ["Next.js", "TypeScript"],
      fileStructure: ["app/", "lib/"],
      configFiles: ["package.json"],
    };

    const createMockClient = (response: string): AIClient => ({
      chat: vi.fn().mockResolvedValue(response),
      getProvider: () => "anthropic",
      getModel: () => "claude-sonnet-4-20250514",
    });

    it("should initialize new brainstorm without existing context", async () => {
      const mockResponse = JSON.stringify({
        message: "Let's brainstorm! What type of task is this?",
        options: [
          { label: "New feature", value: "new_feature" },
          { label: "Bug fix", value: "bug_fix" },
        ],
        brainstormPreview: {
          summary: "Initial task understanding",
          requirements: [],
          considerations: [],
          suggestedApproach: "TBD",
        },
        suggestComplete: false,
      });

      const client = createMockClient(mockResponse);
      const result = await initializeBrainstorm(
        client,
        "Add user auth",
        "Implement login/logout",
        mockRepoContext
      );

      expect(result.message).toContain("brainstorm");
      expect(result.options).toHaveLength(2);
      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("should initialize brainstorm with existing context for refinement", async () => {
      const existingBrainstorm: ExistingBrainstormContext = {
        summary: "Add JWT-based authentication",
        requirements: ["Login endpoint", "Token refresh"],
        considerations: ["Security", "Session management"],
        suggestedApproach: "Use NextAuth with JWT strategy",
      };

      const mockResponse = JSON.stringify({
        message: "I see you've already brainstormed this. What would you like to refine?",
        options: [
          { label: "Add more requirements", value: "add_requirements" },
          { label: "Change approach", value: "change_approach" },
        ],
        brainstormPreview: existingBrainstorm,
        suggestComplete: false,
      });

      const client = createMockClient(mockResponse);
      const result = await initializeBrainstorm(
        client,
        "Add user auth",
        "Implement login/logout",
        mockRepoContext,
        existingBrainstorm
      );

      expect(result.message).toContain("refine");
      expect(result.brainstormPreview).toEqual(existingBrainstorm);

      // Verify the prompt includes existing context
      const chatCall = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userMessage = chatCall[0].find((m: { role: string }) => m.role === "user");
      expect(userMessage.content).toContain("CURRENT BACKLOG ITEM STATE");
      expect(userMessage.content).toContain("JWT-based authentication");
    });

    it("should handle AI response parsing errors gracefully", async () => {
      const client = createMockClient("This is not valid JSON");
      const result = await initializeBrainstorm(
        client,
        "Test task",
        null,
        mockRepoContext
      );

      // Should return fallback response
      expect(result.message).toBeDefined();
      expect(result.options).toBeDefined();
      expect(result.suggestComplete).toBe(false);
    });

    it("should pre-populate preview when refining and AI doesn't return one", async () => {
      const existingBrainstorm: ExistingBrainstormContext = {
        summary: "Test summary",
        requirements: ["req1"],
        considerations: ["con1"],
        suggestedApproach: "approach",
      };

      const mockResponse = JSON.stringify({
        message: "What would you like to change?",
        options: [{ label: "Option 1", value: "opt1" }],
        suggestComplete: false,
        // No brainstormPreview provided
      });

      const client = createMockClient(mockResponse);
      const result = await initializeBrainstorm(
        client,
        "Test task",
        null,
        mockRepoContext,
        existingBrainstorm
      );

      // Should use existing brainstorm as preview
      expect(result.brainstormPreview).toEqual(existingBrainstorm);
    });
  });
});
