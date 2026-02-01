import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getConversation,
  setConversation,
  deleteConversation,
  initializeBrainstorm,
  generateInitialBrainstorm,
  extractJSON,
  getTaskSpecificPrompt,
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

  describe("extractJSON", () => {
    it("should parse valid JSON directly", () => {
      const json = '{"key": "value", "number": 42}';
      const result = extractJSON(json);
      expect(result).toEqual({ key: "value", number: 42 });
    });

    it("should extract JSON from markdown code blocks with json tag", () => {
      const response = 'Here is the response:\n```json\n{"summary": "test", "count": 5}\n```\nAnd some more text.';
      const result = extractJSON(response);
      expect(result).toEqual({ summary: "test", count: 5 });
    });

    it("should extract JSON from markdown code blocks without language tag", () => {
      const response = 'Output:\n```\n{"message": "hello"}\n```';
      const result = extractJSON(response);
      expect(result).toEqual({ message: "hello" });
    });

    it("should find JSON object embedded in text", () => {
      const response = 'Here is the result: {"summary": "test analysis", "items": [1, 2, 3]} and more text after';
      const result = extractJSON(response);
      expect(result).toEqual({ summary: "test analysis", items: [1, 2, 3] });
    });

    it("should extract JSON array from text", () => {
      const response = 'The list is: ["apple", "banana", "cherry"] - enjoy!';
      const result = extractJSON(response);
      expect(result).toEqual(["apple", "banana", "cherry"]);
    });

    it("should handle nested JSON objects", () => {
      const json = '{"outer": {"inner": {"deep": "value"}}, "array": [1, {"nested": true}]}';
      const result = extractJSON(json);
      expect(result).toEqual({
        outer: { inner: { deep: "value" } },
        array: [1, { nested: true }],
      });
    });

    it("should return null for completely invalid input", () => {
      const result = extractJSON("not valid json at all, just plain text");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = extractJSON("");
      expect(result).toBeNull();
    });

    it("should handle whitespace around JSON", () => {
      const response = '   \n  {"trimmed": true}  \n   ';
      const result = extractJSON(response);
      expect(result).toEqual({ trimmed: true });
    });

    it("should prefer code block JSON over embedded JSON", () => {
      // Code block JSON should be extracted even if there's text with braces elsewhere
      const response = 'Some {invalid text} here\n```json\n{"correct": true}\n```';
      const result = extractJSON(response);
      expect(result).toEqual({ correct: true });
    });

    it("should handle malformed JSON in code blocks gracefully", () => {
      // If code block has invalid JSON, fall back to finding JSON in text
      // Note: The fallback uses first { to last }, so we need valid JSON outside the code block
      const response = '```json\nnot json at all\n```\nActual result: {"fallback": true}';
      const result = extractJSON(response);
      expect(result).toEqual({ fallback: true });
    });

    it("should return null for primitive JSON values", () => {
      // Only objects and arrays are considered valid results
      const result = extractJSON('"just a string"');
      expect(result).toBeNull();
    });
  });

  describe("getTaskSpecificPrompt", () => {
    it("should return testing prompt for test-related tasks", () => {
      const result = getTaskSpecificPrompt("Add unit tests", null);
      expect(result).toContain("TASK TYPE: Testing/Coverage");
      expect(result).toContain("test coverage");
    });

    it("should return testing prompt when description contains test keywords", () => {
      const result = getTaskSpecificPrompt("Improve code quality", "We need better coverage on the auth module");
      expect(result).toContain("TASK TYPE: Testing/Coverage");
    });

    it("should return testing prompt for spec keyword", () => {
      const result = getTaskSpecificPrompt("Write spec files for components", null);
      expect(result).toContain("TASK TYPE: Testing/Coverage");
    });

    it("should return refactoring prompt for refactor tasks", () => {
      const result = getTaskSpecificPrompt("Refactor authentication module", null);
      expect(result).toContain("TASK TYPE: Refactoring");
      expect(result).toContain("DRY, SOLID");
    });

    it("should return refactoring prompt for cleanup tasks", () => {
      const result = getTaskSpecificPrompt("Cleanup legacy code", null);
      expect(result).toContain("TASK TYPE: Refactoring");
    });

    it("should return refactoring prompt for reorganize tasks", () => {
      const result = getTaskSpecificPrompt("Reorganize folder structure", null);
      expect(result).toContain("TASK TYPE: Refactoring");
    });

    it("should return bug fix prompt for fix tasks", () => {
      const result = getTaskSpecificPrompt("Fix login bug", null);
      expect(result).toContain("TASK TYPE: Bug Fix");
      expect(result).toContain("Root cause analysis");
    });

    it("should return bug fix prompt for bug keyword", () => {
      const result = getTaskSpecificPrompt("Address critical bug in payment", null);
      expect(result).toContain("TASK TYPE: Bug Fix");
    });

    it("should return bug fix prompt for issue keyword", () => {
      const result = getTaskSpecificPrompt("Resolve issue with notifications", null);
      expect(result).toContain("TASK TYPE: Bug Fix");
    });

    it("should return bug fix prompt for error keyword", () => {
      const result = getTaskSpecificPrompt("Handle error in data sync", null);
      expect(result).toContain("TASK TYPE: Bug Fix");
    });

    it("should return performance prompt for optimization tasks", () => {
      const result = getTaskSpecificPrompt("Optimize database queries", null);
      expect(result).toContain("TASK TYPE: Performance Optimization");
      expect(result).toContain("Profiling");
    });

    it("should return performance prompt for performance keyword", () => {
      const result = getTaskSpecificPrompt("Improve performance of list rendering", null);
      expect(result).toContain("TASK TYPE: Performance Optimization");
    });

    it("should return performance prompt for speed keyword", () => {
      const result = getTaskSpecificPrompt("Speed up API response times", null);
      expect(result).toContain("TASK TYPE: Performance Optimization");
    });

    it("should return performance prompt for slow keyword", () => {
      // Note: "Fix" would trigger bug fix detection first, so use title without "fix"
      const result = getTaskSpecificPrompt("Investigate slow page load", null);
      expect(result).toContain("TASK TYPE: Performance Optimization");
    });

    it("should return feature prompt as default", () => {
      const result = getTaskSpecificPrompt("Add new dashboard", null);
      expect(result).toContain("TASK TYPE: Feature Implementation");
      expect(result).toContain("acceptance criteria");
    });

    it("should return feature prompt for unmatched tasks", () => {
      const result = getTaskSpecificPrompt("Create user profile page", "Display user information");
      expect(result).toContain("TASK TYPE: Feature Implementation");
    });

    it("should be case insensitive in detection", () => {
      const result1 = getTaskSpecificPrompt("ADD UNIT TESTS", null);
      const result2 = getTaskSpecificPrompt("add unit tests", null);
      expect(result1).toContain("TASK TYPE: Testing/Coverage");
      expect(result2).toContain("TASK TYPE: Testing/Coverage");
    });

    it("should detect type from description when title is generic", () => {
      const result = getTaskSpecificPrompt("Update module", "refactor to use new patterns");
      expect(result).toContain("TASK TYPE: Refactoring");
    });
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

  describe("generateInitialBrainstorm", () => {
    const mockRepoContext: RepoContext = {
      techStack: ["Next.js", "TypeScript", "Drizzle ORM"],
      fileStructure: ["app/", "lib/", "components/"],
      configFiles: ["package.json", "tsconfig.json", "drizzle.config.ts"],
    };

    const createMockClient = (response: string): AIClient => ({
      chat: vi.fn().mockResolvedValue(response),
      getProvider: () => "anthropic",
      getModel: () => "claude-sonnet-4-20250514",
    });

    const validJsonResponse = JSON.stringify({
      summary: "Implement user authentication with JWT tokens",
      requirements: ["Login endpoint", "Logout endpoint", "Token refresh"],
      considerations: ["Security best practices", "Session management"],
      suggestedApproach: "Use NextAuth.js with JWT strategy",
    });

    it("should return brainstorm preview with all fields", async () => {
      const client = createMockClient(validJsonResponse);
      const result = await generateInitialBrainstorm(
        client,
        "Add user authentication",
        "Implement login and logout functionality",
        mockRepoContext
      );

      expect(result).toBeDefined();
      expect(result?.summary).toBe("Implement user authentication with JWT tokens");
      expect(result?.requirements).toHaveLength(3);
      expect(result?.considerations).toHaveLength(2);
      expect(result?.suggestedApproach).toContain("NextAuth");
    });

    it("should include config files in prompt when provided", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Add feature",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("package.json");
      expect(userPrompt.content).toContain("tsconfig.json");
      expect(userPrompt.content).toContain("drizzle.config.ts");
    });

    it("should include tech stack in prompt", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Add feature",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("Next.js");
      expect(userPrompt.content).toContain("TypeScript");
      expect(userPrompt.content).toContain("Drizzle ORM");
    });

    it("should handle empty repo context gracefully", async () => {
      const emptyContext: RepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
      };

      const client = createMockClient(validJsonResponse);
      const result = await generateInitialBrainstorm(
        client,
        "Task",
        null,
        emptyContext
      );

      expect(result).toBeDefined();
      expect(result?.summary).toBeDefined();
    });

    it("should include task-specific prompt for testing tasks", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Add unit tests for auth module",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("TASK TYPE: Testing/Coverage");
    });

    it("should include task-specific prompt for refactoring tasks", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Refactor authentication module",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("TASK TYPE: Refactoring");
    });

    it("should include task-specific prompt for bug fix tasks", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Fix login bug",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("TASK TYPE: Bug Fix");
    });

    it("should include task-specific prompt for performance tasks", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Optimize database queries",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("TASK TYPE: Performance Optimization");
    });

    it("should use feature prompt as default", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Add new dashboard",
        null,
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("TASK TYPE: Feature Implementation");
    });

    it("should handle malformed JSON responses with fallback", async () => {
      const client = createMockClient("This is not valid JSON at all");
      const result = await generateInitialBrainstorm(
        client,
        "Test task",
        null,
        mockRepoContext
      );

      // Should return fallback structure
      expect(result).toBeDefined();
      expect(result?.summary).toContain("Test task");
      expect(result?.requirements).toBeDefined();
      expect(Array.isArray(result?.requirements)).toBe(true);
    });

    it("should extract JSON from markdown code blocks in response", async () => {
      const markdownResponse = `Here's my analysis:
\`\`\`json
{
  "summary": "Extracted from markdown",
  "requirements": ["req1"],
  "considerations": ["con1"],
  "suggestedApproach": "approach"
}
\`\`\`
Hope this helps!`;

      const client = createMockClient(markdownResponse);
      const result = await generateInitialBrainstorm(
        client,
        "Task",
        null,
        mockRepoContext
      );

      expect(result?.summary).toBe("Extracted from markdown");
    });

    it("should include task description in prompt when provided", async () => {
      const client = createMockClient(validJsonResponse);
      await generateInitialBrainstorm(
        client,
        "Add feature",
        "Detailed description of the feature requirements",
        mockRepoContext
      );

      const [messages] = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const userPrompt = messages.find((m: { role: string }) => m.role === "user");
      expect(userPrompt.content).toContain("Detailed description of the feature requirements");
    });

    it("should handle partial JSON response", async () => {
      // Response with missing fields
      const partialResponse = JSON.stringify({
        summary: "Partial response",
        // Missing requirements, considerations, suggestedApproach
      });

      const client = createMockClient(partialResponse);
      const result = await generateInitialBrainstorm(
        client,
        "Task",
        null,
        mockRepoContext
      );

      expect(result?.summary).toBe("Partial response");
      expect(result?.requirements).toEqual([]);
      expect(result?.considerations).toEqual([]);
    });
  });
});
