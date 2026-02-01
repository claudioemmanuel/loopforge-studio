import { describe, it, expect, vi } from "vitest";
import {
  generateExperiment,
  validateExperimentConfig,
  testAreas,
  type GeneratedExperiment,
} from "@/lib/ai/experiment-generator";
import type { AIClient } from "@/lib/ai/client";

/** Creates a mock AIClient for testing */
function createMockAIClient(responseText: string): AIClient {
  return {
    chat: vi.fn().mockResolvedValue(responseText),
    getProvider: vi.fn().mockReturnValue("anthropic"),
    getModel: vi.fn().mockReturnValue("claude-sonnet-4-20250514"),
  };
}

describe("Experiment Generator", () => {
  describe("generateExperiment", () => {
    it("should generate experiment for brainstorming test area", async () => {
      const mockResponse = JSON.stringify({
        experimentName: "Brainstorming Speed Test",
        experimentDescription: "Test different brainstorming speeds",
        variants: [
          {
            name: "Fast & Concise",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Be fast and concise",
              },
            },
          },
          {
            name: "Thorough & Detailed",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Be thorough and detailed",
              },
            },
          },
          {
            name: "Balanced",
            weight: 34,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Balance speed and detail",
              },
            },
          },
        ],
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await generateExperiment(mockClient, "brainstorming", {
        speed_vs_thoroughness: "Speed",
        focus: "Technical details",
      });

      expect(result.name).toBe("Brainstorming Speed Test");
      expect(result.description).toBe("Test different brainstorming speeds");
      expect(result.variants).toHaveLength(3);
      expect(result.variants[0].name).toBe("Fast & Concise");
      expect(result.variants[0].weight).toBe(33);
      expect(mockClient.chat).toHaveBeenCalledTimes(1);
    });

    it("should generate experiment for planning test area", async () => {
      const mockResponse = JSON.stringify({
        experimentName: "Planning Granularity Test",
        experimentDescription: "Test different planning granularities",
        variants: [
          {
            name: "Detailed Steps",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Create detailed step-by-step plans",
              },
            },
          },
          {
            name: "High-level Milestones",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Create high-level milestone plans",
              },
            },
          },
          {
            name: "Hybrid",
            weight: 34,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Mix detailed and high-level",
              },
            },
          },
        ],
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await generateExperiment(mockClient, "planning", {
        granularity: "Detailed steps",
        file_paths: "Yes, always",
      });

      expect(result.name).toBe("Planning Granularity Test");
      expect(result.variants).toHaveLength(3);
    });

    it("should generate experiment for code_generation test area", async () => {
      const mockResponse = JSON.stringify({
        experimentName: "Code Gen Refactoring Test",
        experimentDescription: "Test different refactoring styles",
        variants: [
          {
            name: "Conservative",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Refactor conservatively",
              },
            },
          },
          {
            name: "Moderate",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Refactor moderately",
              },
            },
          },
          {
            name: "Aggressive",
            weight: 34,
            config: {
              type: "prompt",
              promptOverrides: {
                system_prompt: "Refactor aggressively",
              },
            },
          },
        ],
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await generateExperiment(mockClient, "code_generation", {
        refactoring_style: "Conservative",
        comment_density: "Minimal",
      });

      expect(result.name).toBe("Code Gen Refactoring Test");
      expect(result.variants).toHaveLength(3);
    });

    it("should generate experiment for model_params test area", async () => {
      const mockResponse = JSON.stringify({
        experimentName: "Model Parameters Optimization",
        experimentDescription: "Optimize model parameters",
        variants: [
          {
            name: "Quality-focused",
            weight: 33,
            config: {
              type: "parameters",
              parameterOverrides: {
                temperature: 0.3,
                maxTokens: 8192,
              },
            },
          },
          {
            name: "Balanced",
            weight: 33,
            config: {
              type: "parameters",
              parameterOverrides: {
                temperature: 0.5,
                maxTokens: 4096,
              },
            },
          },
          {
            name: "Cost-optimized",
            weight: 34,
            config: {
              type: "parameters",
              parameterOverrides: {
                temperature: 0.7,
                maxTokens: 2048,
              },
            },
          },
        ],
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await generateExperiment(mockClient, "model_params", {
        optimization_goal: "Quality",
        risk_tolerance: "Low (conservative)",
      });

      expect(result.name).toBe("Model Parameters Optimization");
      expect(result.variants).toHaveLength(3);
      expect(result.variants[0].config.type).toBe("parameters");
    });

    it("should normalize weights to sum to 100", async () => {
      const mockResponse = JSON.stringify({
        experimentName: "Test",
        experimentDescription: "Test",
        variants: [
          {
            name: "A",
            weight: 30,
            config: { type: "prompt", promptOverrides: { system_prompt: "A" } },
          },
          {
            name: "B",
            weight: 30,
            config: { type: "prompt", promptOverrides: { system_prompt: "B" } },
          },
          {
            name: "C",
            weight: 30,
            config: { type: "prompt", promptOverrides: { system_prompt: "C" } },
          },
        ],
      });

      const mockClient = createMockAIClient(mockResponse);

      const result = await generateExperiment(mockClient, "brainstorming", {
        speed_vs_thoroughness: "Speed",
      });

      const totalWeight = result.variants.reduce(
        (sum, v) => sum + v.weight,
        0,
      );
      expect(totalWeight).toBe(100);
    });

    it("should handle markdown code blocks in response", async () => {
      const mockResponse = `\`\`\`json
{
  "experimentName": "Test Experiment",
  "experimentDescription": "Test description",
  "variants": [
    {
      "name": "Variant A",
      "weight": 33,
      "config": {
        "type": "prompt",
        "promptOverrides": { "system_prompt": "Test" }
      }
    },
    {
      "name": "Variant B",
      "weight": 33,
      "config": {
        "type": "prompt",
        "promptOverrides": { "system_prompt": "Test" }
      }
    },
    {
      "name": "Variant C",
      "weight": 34,
      "config": {
        "type": "prompt",
        "promptOverrides": { "system_prompt": "Test" }
      }
    }
  ]
}
\`\`\``;

      const mockClient = createMockAIClient(mockResponse);

      const result = await generateExperiment(mockClient, "brainstorming", {
        speed_vs_thoroughness: "Speed",
      });

      expect(result.name).toBe("Test Experiment");
      expect(result.variants).toHaveLength(3);
    });

    it("should throw error for invalid JSON", async () => {
      const mockClient = createMockAIClient("This is not valid JSON");

      await expect(
        generateExperiment(mockClient, "brainstorming", {
          speed_vs_thoroughness: "Speed",
        }),
      ).rejects.toThrow("Failed to parse AI response");
    });

    it("should throw error for missing required fields", async () => {
      const mockResponse = JSON.stringify({
        experimentName: "Test",
        // Missing experimentDescription and variants
      });

      const mockClient = createMockAIClient(mockResponse);

      await expect(
        generateExperiment(mockClient, "brainstorming", {
          speed_vs_thoroughness: "Speed",
        }),
      ).rejects.toThrow("Invalid experiment structure");
    });
  });

  describe("validateExperimentConfig", () => {
    it("should validate correct experiment config", () => {
      const validExperiment: GeneratedExperiment = {
        name: "Valid Experiment",
        description: "This is a valid experiment description",
        variants: [
          {
            name: "Variant A",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "Variant B",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "Variant C",
            weight: 34,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(validExperiment);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail for short experiment name", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Test",
        description: "Valid description",
        variants: [
          {
            name: "A",
            weight: 50,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "B",
            weight: 50,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "C",
            weight: 0,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("name is too short"))).toBe(
        true,
      );
    });

    it("should fail for short description", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Valid Name",
        description: "Short",
        variants: [
          {
            name: "A",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "B",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "C",
            weight: 34,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("description is too short")),
      ).toBe(true);
    });

    it("should fail for incorrect number of variants", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Valid Name",
        description: "Valid description",
        variants: [
          {
            name: "A",
            weight: 50,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "B",
            weight: 50,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("exactly 3 variants"))).toBe(
        true,
      );
    });

    it("should fail for invalid weight range", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Valid Name",
        description: "Valid description",
        variants: [
          {
            name: "A",
            weight: 150,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "B",
            weight: -10,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "C",
            weight: 60,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("out of range"))).toBe(true);
    });

    it("should fail for weights not summing to 100", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Valid Name",
        description: "Valid description",
        variants: [
          {
            name: "A",
            weight: 30,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "B",
            weight: 30,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "C",
            weight: 30,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("sum to 100%"))).toBe(true);
    });

    it("should fail for prompt type without promptOverrides", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Valid Name",
        description: "Valid description",
        variants: [
          {
            name: "A",
            weight: 33,
            config: {
              type: "prompt",
              // Missing promptOverrides
            },
          },
          {
            name: "B",
            weight: 33,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
          {
            name: "C",
            weight: 34,
            config: {
              type: "prompt",
              promptOverrides: { system_prompt: "Test" },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("missing promptOverrides")),
      ).toBe(true);
    });

    it("should fail for parameters type without parameterOverrides", () => {
      const invalidExperiment: GeneratedExperiment = {
        name: "Valid Name",
        description: "Valid description",
        variants: [
          {
            name: "A",
            weight: 33,
            config: {
              type: "parameters",
              // Missing parameterOverrides
            },
          },
          {
            name: "B",
            weight: 33,
            config: {
              type: "parameters",
              parameterOverrides: { temperature: 0.5 },
            },
          },
          {
            name: "C",
            weight: 34,
            config: {
              type: "parameters",
              parameterOverrides: { temperature: 0.7 },
            },
          },
        ],
      };

      const result = validateExperimentConfig(invalidExperiment);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("missing parameterOverrides")),
      ).toBe(true);
    });
  });

  describe("testAreas", () => {
    it("should export all test areas", () => {
      expect(testAreas).toHaveLength(4);
      expect(testAreas).toContain("brainstorming");
      expect(testAreas).toContain("planning");
      expect(testAreas).toContain("code_generation");
      expect(testAreas).toContain("model_params");
    });
  });
});
