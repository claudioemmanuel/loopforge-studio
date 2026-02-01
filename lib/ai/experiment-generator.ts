import type { AIClient } from "./client";
import type { ExperimentVariantConfig } from "@/lib/db/schema/types";

// Test areas that can be experimented on
export const testAreas = [
  "brainstorming",
  "planning",
  "code_generation",
  "model_params",
] as const;
export type TestArea = (typeof testAreas)[number];

// User answers collected from wizard
export interface UserAnswers {
  [key: string]: string;
}

// Generated experiment structure
export interface GeneratedExperiment {
  name: string;
  description: string;
  variants: GeneratedVariant[];
}

export interface GeneratedVariant {
  name: string;
  weight: number;
  config: ExperimentVariantConfig;
}

// Questions to ask per test area
export const testAreaQuestions: Record<TestArea, string[]> = {
  brainstorming: [
    "Do you prioritize speed or thoroughness?",
    "Should the AI focus on technical details or business context?",
  ],
  planning: [
    "Do you prefer detailed step-by-step plans or high-level milestones?",
    "Should file paths be included in the plan?",
  ],
  code_generation: [
    "Should refactoring be conservative, moderate, or aggressive?",
    "What level of code comments do you prefer?",
  ],
  model_params: [
    "Should we optimize for quality or cost?",
    "What's your tolerance for creative/risky outputs?",
  ],
};

/**
 * Generate AI prompt for creating experiment variants
 */
function buildExperimentPrompt(
  testArea: TestArea,
  userAnswers: UserAnswers,
): string {
  const areaDescriptions: Record<TestArea, string> = {
    brainstorming:
      "Brainstorming is the conversational phase where AI discusses approaches with users before planning.",
    planning:
      "Planning is where AI generates a structured execution plan with tasks and file paths.",
    code_generation:
      "Code generation is the autonomous phase where AI (Ralph) implements changes, refactors code, and commits.",
    model_params:
      "Model parameters control the AI's behavior like temperature, max tokens, and other settings.",
  };

  const exampleConfigs: Record<TestArea, string> = {
    brainstorming: `
Example variants for brainstorming:
- Fast & Concise: Short responses, quick analysis, minimal follow-up questions
- Thorough & Detailed: Comprehensive analysis, multiple perspectives, deep dives
- Balanced: Mix of speed and depth based on task complexity
`,
    planning: `
Example variants for planning:
- Step-by-step: Granular tasks (2-5 min each), detailed file paths, explicit commands
- Milestone-based: High-level phases, flexible sub-tasks, outcome-focused
- Hybrid: Combine detailed steps for critical paths, milestones for peripheral work
`,
    code_generation: `
Example variants for code generation:
- Conservative: Minimal changes, preserve existing patterns, comprehensive comments
- Moderate: Balanced refactoring, moderate comments, follow project conventions
- Aggressive: Optimize aggressively, minimal comments, modern patterns
`,
    model_params: `
Example variants for model parameters:
- Quality-focused: Lower temperature (0.3), higher max tokens (8192), precise outputs
- Balanced: Medium temperature (0.5), standard tokens (4096), reliable quality
- Cost-optimized: Higher temperature (0.7), lower tokens (2048), faster/cheaper
`,
  };

  const answersText = Object.entries(userAnswers)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  return `You are an AI experiment designer for Loopforge Studio, an autonomous coding platform.

**Task**: Generate 3 distinct A/B test variants for the "${testArea}" test area.

**Context**: ${areaDescriptions[testArea]}

**User Preferences**:
${answersText}

${exampleConfigs[testArea]}

**Requirements**:
1. Create exactly 3 variants with meaningfully different configurations
2. Each variant should have:
   - A descriptive name (2-4 words, e.g., "Fast & Concise")
   - Equal weight (33% each, sum to 100%)
   - A complete configuration matching the test area
3. Variants should reflect the user's preferences from their answers
4. Ensure variants are testable (measurably different outcomes)

**Output Format** (JSON):
{
  "experimentName": "Descriptive experiment name (4-6 words)",
  "experimentDescription": "1-2 sentence description of what's being tested",
  "variants": [
    {
      "name": "Variant A Name",
      "weight": 33,
      "config": {
        "type": "prompt|model|parameters",
        "promptOverrides": { "system_prompt": "...", "user_prompt_template": "..." },
        "modelOverride": "model-name-if-applicable",
        "parameterOverrides": { "temperature": 0.5, "maxTokens": 4096 }
      }
    },
    // ... 2 more variants (weights should sum to 100)
  ]
}

**Important**:
- For brainstorming/planning/code_generation: Set "type": "prompt" and include "promptOverrides"
- For model_params: Set "type": "parameters" and include "parameterOverrides"
- Prompt overrides should contain complete, production-ready system prompts
- Parameter overrides should be valid for all AI providers (temperature 0-1, maxTokens > 0)

Generate the experiment configuration now:`;
}

/**
 * Parse AI response and extract JSON experiment config
 */
function parseExperimentResponse(response: string): GeneratedExperiment {
  // Try to extract JSON from markdown code blocks or raw text
  let jsonText = response.trim();

  // Remove markdown code blocks
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  }

  // Parse JSON
  try {
    const parsed = JSON.parse(jsonText);

    // Validate structure
    if (
      !parsed.experimentName ||
      !parsed.experimentDescription ||
      !Array.isArray(parsed.variants) ||
      parsed.variants.length !== 3
    ) {
      throw new Error("Invalid experiment structure");
    }

    // Ensure weights sum to 100
    const totalWeight = parsed.variants.reduce(
      (sum: number, v: GeneratedVariant) => sum + v.weight,
      0,
    );
    if (totalWeight !== 100) {
      // Normalize weights
      parsed.variants.forEach((v: GeneratedVariant) => {
        v.weight = Math.round((v.weight / totalWeight) * 100);
      });
      // Fix rounding errors
      const diff =
        100 -
        parsed.variants.reduce(
          (sum: number, v: GeneratedVariant) => sum + v.weight,
          0,
        );
      if (diff !== 0) {
        parsed.variants[0].weight += diff;
      }
    }

    return {
      name: parsed.experimentName,
      description: parsed.experimentDescription,
      variants: parsed.variants,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generate experiment configuration using AI
 */
export async function generateExperiment(
  aiClient: AIClient,
  testArea: TestArea,
  userAnswers: UserAnswers,
): Promise<GeneratedExperiment> {
  const prompt = buildExperimentPrompt(testArea, userAnswers);

  const response = await aiClient.chat(
    [
      {
        role: "user",
        content: prompt,
      },
    ],
    {
      temperature: 0.7, // Moderate creativity for variant generation
      maxTokens: 4096,
    },
  );

  return parseExperimentResponse(response);
}

/**
 * Validate experiment configuration
 */
export function validateExperimentConfig(experiment: GeneratedExperiment): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check name
  if (!experiment.name || experiment.name.length < 5) {
    errors.push("Experiment name is too short");
  }

  // Check description
  if (!experiment.description || experiment.description.length < 10) {
    errors.push("Experiment description is too short");
  }

  // Check variants
  if (!experiment.variants || experiment.variants.length !== 3) {
    errors.push("Must have exactly 3 variants");
  }

  // Check each variant
  experiment.variants.forEach((variant, idx) => {
    if (!variant.name || variant.name.length < 2) {
      errors.push(`Variant ${idx + 1} name is invalid`);
    }

    if (variant.weight < 0 || variant.weight > 100) {
      errors.push(`Variant ${idx + 1} weight is out of range`);
    }

    if (!variant.config || !variant.config.type) {
      errors.push(`Variant ${idx + 1} config is missing type`);
    }

    // Validate config type matches content
    if (variant.config.type === "prompt" && !variant.config.promptOverrides) {
      errors.push(
        `Variant ${idx + 1} is type 'prompt' but missing promptOverrides`,
      );
    }

    if (
      variant.config.type === "parameters" &&
      !variant.config.parameterOverrides
    ) {
      errors.push(
        `Variant ${idx + 1} is type 'parameters' but missing parameterOverrides`,
      );
    }
  });

  // Check total weight
  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight !== 100) {
    errors.push(
      `Total variant weights must sum to 100% (currently ${totalWeight}%)`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
