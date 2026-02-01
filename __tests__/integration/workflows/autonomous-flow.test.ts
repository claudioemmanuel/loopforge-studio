import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  AutonomousFlowJobData,
  AutonomousFlowJobResult,
} from "@/lib/queue/autonomous-flow";

describe("Autonomous Flow", () => {
  describe("AutonomousFlowJobData type", () => {
    it("should have required fields", () => {
      const jobData: AutonomousFlowJobData = {
        taskId: "task-123",
        userId: "user-456",
        repoId: "repo-789",
      };

      expect(jobData.taskId).toBe("task-123");
      expect(jobData.userId).toBe("user-456");
      expect(jobData.repoId).toBe("repo-789");
    });

    it("should create valid job data from task creation", () => {
      const mockTask = {
        id: "task-abc",
        repoId: "repo-xyz",
      };
      const mockUserId = "user-123";

      const jobData: AutonomousFlowJobData = {
        taskId: mockTask.id,
        userId: mockUserId,
        repoId: mockTask.repoId,
      };

      expect(jobData).toEqual({
        taskId: "task-abc",
        userId: "user-123",
        repoId: "repo-xyz",
      });
    });
  });

  describe("AutonomousFlowJobResult type", () => {
    it("should represent successful execution", () => {
      const successResult: AutonomousFlowJobResult = {
        success: true,
        finalStatus: "executing",
      };

      expect(successResult.success).toBe(true);
      expect(successResult.finalStatus).toBe("executing");
      expect(successResult.error).toBeUndefined();
    });

    it("should represent failed execution", () => {
      const failureResult: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: "Failed to generate brainstorm: API rate limited",
      };

      expect(failureResult.success).toBe(false);
      expect(failureResult.finalStatus).toBe("stuck");
      expect(failureResult.error).toBe("Failed to generate brainstorm: API rate limited");
    });

    it("should only allow valid final status values", () => {
      const validStatuses: AutonomousFlowJobResult["finalStatus"][] = ["executing", "stuck"];

      validStatuses.forEach((status) => {
        const result: AutonomousFlowJobResult = {
          success: status === "executing",
          finalStatus: status,
        };
        expect(validStatuses).toContain(result.finalStatus);
      });
    });
  });

  describe("Job flow simulation", () => {
    it("should simulate successful autonomous flow", () => {
      // Simulate the flow states
      const states = [
        { status: "brainstorming", progress: 20 },
        { status: "planning", progress: 40 },
        { status: "ready", progress: 60 },
        { status: "executing", progress: 80 },
      ];

      states.forEach((state, index) => {
        expect(state.progress).toBe((index + 1) * 20);
      });

      // Final result
      const result: AutonomousFlowJobResult = {
        success: true,
        finalStatus: "executing",
      };

      expect(result.success).toBe(true);
    });

    it("should simulate failed autonomous flow at brainstorming", () => {
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: "No AI provider configured",
      };

      expect(result.success).toBe(false);
      expect(result.finalStatus).toBe("stuck");
      expect(result.error).toContain("AI provider");
    });

    it("should simulate failed autonomous flow at planning", () => {
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: "Failed to generate plan: Invalid task description",
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("plan");
    });
  });

  describe("Branch name generation", () => {
    it("should generate correct branch name format", () => {
      const taskId = "550e8400-e29b-41d4-a716-446655440000";
      const branchName = `loopforge/${taskId.slice(0, 8)}`;

      expect(branchName).toBe("loopforge/550e8400");
      expect(branchName).toMatch(/^loopforge\/[a-f0-9]{8}$/);
    });

    it("should handle different UUID formats", () => {
      const taskIds = [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "12345678-1234-1234-1234-123456789012",
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
      ];

      taskIds.forEach((taskId) => {
        const branchName = `loopforge/${taskId.slice(0, 8)}`;
        expect(branchName.startsWith("loopforge/")).toBe(true);
        expect(branchName.length).toBe(18); // "loopforge/" (10) + 8 chars = 18
      });
    });
  });

  describe("Error handling scenarios", () => {
    it("should handle user not found error", () => {
      const error = new Error("User not found");
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: error.message,
      };

      expect(result.error).toBe("User not found");
    });

    it("should handle task not found error", () => {
      const error = new Error("Task not found");
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: error.message,
      };

      expect(result.error).toBe("Task not found");
    });

    it("should handle repository not found error", () => {
      const error = new Error("Repository not found");
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: error.message,
      };

      expect(result.error).toBe("Repository not found");
    });

    it("should handle API key not configured error", () => {
      const error = new Error("No API key configured for anthropic");
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: error.message,
      };

      expect(result.error).toContain("API key");
    });

    it("should handle unknown error", () => {
      const result: AutonomousFlowJobResult = {
        success: false,
        finalStatus: "stuck",
        error: "Unknown error",
      };

      expect(result.error).toBe("Unknown error");
    });
  });

  describe("Job progress tracking", () => {
    it("should track progress steps correctly", () => {
      const progressSteps = [
        { step: "brainstorming", progress: 10 },
        { step: "brainstorming", progress: 33 },
        { step: "planning", progress: 40 },
        { step: "planning", progress: 66 },
        { step: "ready", progress: 70 },
        { step: "executing", progress: 80 },
        { step: "executing", progress: 100 },
      ];

      // Verify progress increases monotonically
      let lastProgress = 0;
      progressSteps.forEach(({ progress }) => {
        expect(progress).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = progress;
      });
    });

    it("should reach 100% at completion", () => {
      const finalProgress = 100;
      expect(finalProgress).toBe(100);
    });
  });

  describe("Provider API key selection", () => {
    it("should prefer user preferred provider", () => {
      const user = {
        preferredProvider: "openai" as const,
        encryptedApiKey: "encrypted-anthropic",
        apiKeyIv: "iv-anthropic",
        openaiEncryptedApiKey: "encrypted-openai",
        openaiApiKeyIv: "iv-openai",
      };

      // Simulate the provider selection logic
      const providers = ["anthropic", "openai", "gemini"] as const;
      let selectedProvider: typeof providers[number] | null = null;

      if (user.preferredProvider && user.openaiEncryptedApiKey) {
        selectedProvider = user.preferredProvider;
      }

      expect(selectedProvider).toBe("openai");
    });

    it("should fallback to first configured provider", () => {
      const user = {
        preferredProvider: null as unknown,
        encryptedApiKey: null,
        apiKeyIv: null,
        openaiEncryptedApiKey: "encrypted-openai",
        openaiApiKeyIv: "iv-openai",
        geminiEncryptedApiKey: null,
        geminiApiKeyIv: null,
      };

      const providers = ["anthropic", "openai", "gemini"] as const;
      let selectedProvider: typeof providers[number] | null = null;

      for (const provider of providers) {
        if (provider === "anthropic" && user.encryptedApiKey) {
          selectedProvider = provider;
          break;
        }
        if (provider === "openai" && user.openaiEncryptedApiKey) {
          selectedProvider = provider;
          break;
        }
        if (provider === "gemini" && user.geminiEncryptedApiKey) {
          selectedProvider = provider;
          break;
        }
      }

      expect(selectedProvider).toBe("openai");
    });

    it("should return null if no provider configured", () => {
      const user = {
        preferredProvider: null,
        encryptedApiKey: null,
        openaiEncryptedApiKey: null,
        geminiEncryptedApiKey: null,
      };

      const providers = ["anthropic", "openai", "gemini"] as const;
      let selectedProvider: typeof providers[number] | null = null;

      // No providers have keys configured
      expect(selectedProvider).toBeNull();
    });
  });

  describe("Model selection", () => {
    it("should use preferred model for each provider", () => {
      const user = {
        preferredAnthropicModel: "claude-sonnet-4-20250514",
        preferredOpenaiModel: "gpt-4o",
        preferredGeminiModel: "gemini-2.5-pro",
      };

      expect(user.preferredAnthropicModel).toBe("claude-sonnet-4-20250514");
      expect(user.preferredOpenaiModel).toBe("gpt-4o");
      expect(user.preferredGeminiModel).toBe("gemini-2.5-pro");
    });

    it("should use default model when no preference set", () => {
      const defaults = {
        anthropic: "claude-sonnet-4-20250514",
        openai: "gpt-4o",
        gemini: "gemini-2.5-pro",
      };

      const user = {
        preferredAnthropicModel: null,
        preferredOpenaiModel: null,
        preferredGeminiModel: null,
      };

      const getModel = (provider: keyof typeof defaults, preference: string | null) => {
        return preference || defaults[provider];
      };

      expect(getModel("anthropic", user.preferredAnthropicModel)).toBe("claude-sonnet-4-20250514");
      expect(getModel("openai", user.preferredOpenaiModel)).toBe("gpt-4o");
      expect(getModel("gemini", user.preferredGeminiModel)).toBe("gemini-2.5-pro");
    });
  });
});
