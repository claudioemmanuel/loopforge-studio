import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/experiments/generate/route";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptApiKey } from "@/lib/crypto";

// Mock the AI client
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    createUserAIClient: vi.fn().mockResolvedValue({
      chat: vi.fn().mockResolvedValue(
        JSON.stringify({
          experimentName: "Generated Test Experiment",
          experimentDescription: "AI-generated experiment for testing",
          variants: [
            {
              name: "Variant A",
              weight: 33,
              config: {
                type: "prompt",
                promptOverrides: {
                  system_prompt: "System prompt for variant A",
                },
              },
            },
            {
              name: "Variant B",
              weight: 33,
              config: {
                type: "prompt",
                promptOverrides: {
                  system_prompt: "System prompt for variant B",
                },
              },
            },
            {
              name: "Variant C",
              weight: 34,
              config: {
                type: "prompt",
                promptOverrides: {
                  system_prompt: "System prompt for variant C",
                },
              },
            },
          ],
        }),
      ),
      getProvider: vi.fn().mockReturnValue("anthropic"),
      getModel: vi.fn().mockReturnValue("claude-sonnet-4-20250514"),
    }),
  };
});

const TEST_PREFIX = `exp-gen-${Date.now()}`;

describe("Experiments Generate API", () => {
  let testUser: schema.User;

  beforeEach(async () => {
    // Create test user with encrypted API key
    const { encrypted, iv } = encryptApiKey("test-api-key");

    [testUser] = await db
      .insert(schema.users)
      .values({
        githubId: `${TEST_PREFIX}-user-${Math.random().toString(36).slice(2)}`,
        username: "testuser",
        encryptedApiKey: encrypted,
        apiKeyIv: iv,
        preferredProvider: "anthropic",
      })
      .returning();
  });

  describe("POST /api/experiments/generate", () => {
    it("should generate experiment for brainstorming test area", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
            focus: "Technical details",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment).toBeDefined();
      expect(data.experiment.name).toBe("Generated Test Experiment");
      expect(data.experiment.description).toBe(
        "AI-generated experiment for testing",
      );
      expect(data.experiment.variants).toHaveLength(3);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.testArea).toBe("brainstorming");
      expect(data.metadata.generatedBy).toBe("anthropic");

      // Verify experiment was saved to database
      const savedExperiment = await db.query.experiments.findFirst({
        where: eq(schema.experiments.id, data.experiment.id),
        with: {
          variants: true,
        },
      });

      expect(savedExperiment).toBeDefined();
      expect(savedExperiment?.variants).toHaveLength(3);
    });

    it("should generate experiment for planning test area", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "planning",
          userAnswers: {
            granularity: "Detailed steps",
            file_paths: "Yes, always",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment).toBeDefined();
      expect(data.metadata.testArea).toBe("planning");
    });

    it("should generate experiment for code_generation test area", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "code_generation",
          userAnswers: {
            refactoring_style: "Conservative",
            comment_density: "Minimal",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment).toBeDefined();
      expect(data.metadata.testArea).toBe("code_generation");
    });

    it("should generate experiment for model_params test area", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "model_params",
          userAnswers: {
            optimization_goal: "Quality",
            risk_tolerance: "Low (conservative)",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment).toBeDefined();
      expect(data.metadata.testArea).toBe("model_params");
    });

    it("should apply custom experiment name", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
            focus: "Technical details",
          },
          customizations: {
            experimentName: "Custom Experiment Name",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment.name).toBe("Custom Experiment Name");
    });

    it("should apply custom traffic allocation", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
            focus: "Technical details",
          },
          customizations: {
            trafficAllocation: 25,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment.trafficAllocation).toBe(25);
    });

    it("should return 400 for invalid test area", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "invalid_area",
          userAnswers: {},
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing required fields", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          // Missing userAnswers
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });

      expect(response.status).toBe(400);
    });

    it("should return error when AI provider not configured", async () => {
      // Create user without API key
      const [userWithoutKey] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-no-key-${Math.random().toString(36).slice(2)}`,
          username: "testuser-no-key",
          // No encrypted API key
        })
        .returning();

      // Mock createUserAIClient to return null for this user
      const { createUserAIClient } = await import("@/lib/api");
      vi.mocked(createUserAIClient).mockResolvedValueOnce(null);

      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: userWithoutKey,
        session: {} as { user?: unknown; expires: string },
      });

      expect(response.status).toBe(400);
    });

    it("should create experiment with draft status", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
            focus: "Technical details",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment.status).toBe("draft");
    });

    it("should create variants with correct weights summing to 100", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
            focus: "Technical details",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);

      const totalWeight = data.experiment.variants.reduce(
        (sum: number, v: { weight: number }) => sum + v.weight,
        0,
      );

      expect(totalWeight).toBe(100);
    });

    it("should save variant configs to database", async () => {
      const request = new Request("http://localhost:3000/api/experiments/generate", {
        method: "POST",
        body: JSON.stringify({
          testArea: "brainstorming",
          userAnswers: {
            speed_vs_thoroughness: "Speed",
            focus: "Technical details",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request, {
        user: testUser,
        session: {} as { user?: unknown; expires: string },
      });
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify variants were saved with configs
      const savedVariants = await db.query.experimentVariants.findMany({
        where: eq(
          schema.experimentVariants.experimentId,
          data.experiment.id,
        ),
      });

      expect(savedVariants).toHaveLength(3);
      savedVariants.forEach((variant) => {
        expect(variant.config).toBeDefined();
        expect(variant.config.type).toBe("prompt");
        expect(variant.config.promptOverrides).toBeDefined();
      });
    });
  });
});
