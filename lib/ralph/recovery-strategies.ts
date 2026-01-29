/**
 * Progressive Error Recovery for Ralph Loop
 *
 * 4-Tier recovery system:
 * 1. Format Guidance - Enhanced with concrete examples
 * 2. Simplified Prompts - Single-file focus
 * 3. Context Reset - Clear history, minimal context
 * 4. Manual Fallback - Generate user instructions
 *
 * Part of Ralph Loop Reliability Improvements (2026-01-29)
 */

import type { AIClient } from "@/lib/ai/client";
import type { StuckSignal } from "./stuck-detector";

export type RecoveryTier =
  | "format_guidance"
  | "simplified_prompt"
  | "context_reset"
  | "manual_fallback";

export interface RecoveryContext {
  tier: RecoveryTier;
  attemptNumber: number;
  maxAttempts: number;
  previousErrors: string[];
  signals: StuckSignal[];
  taskDescription?: string;
  planContent?: string;
}

export interface RecoveryResult {
  success: boolean;
  tier: RecoveryTier;
  message: string;
  modifiedContext?: {
    systemPrompt?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    focusFiles?: string[];
  };
  manualSteps?: string[];
}

/**
 * Abstract recovery strategy.
 */
export abstract class RecoveryStrategy {
  abstract tier: RecoveryTier;
  abstract execute(
    context: RecoveryContext,
    loopContext: {
      taskDescription: string;
      planContent: string;
      workingDir: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
    client: AIClient,
  ): Promise<RecoveryResult>;
}

/**
 * Tier 1: Format Guidance
 * Provides concrete examples of expected output format.
 */
export class FormatGuidanceStrategy extends RecoveryStrategy {
  tier: RecoveryTier = "format_guidance";

  async execute(
    context: RecoveryContext,
    loopContext: {
      taskDescription: string;
      planContent: string;
      workingDir: string;
    },
  ): Promise<RecoveryResult> {
    const formatInstructions = `
IMPORTANT: Your previous response did not contain properly formatted file changes.

Please format your response EXACTLY like this example:

\`\`\`
FILE: path/to/file.ts
\`\`\`
// File content here
export function example() {
  return "code";
}
\`\`\`

You MUST:
1. Start each file with "FILE: path/to/file.ts"
2. Wrap the content in code blocks (triple backticks)
3. Include complete file content, not just snippets
4. Use proper file paths relative to project root

Example for multiple files:

\`\`\`
FILE: src/utils/helper.ts
\`\`\`
export function helper() {
  return true;
}
\`\`\`

\`\`\`
FILE: src/index.ts
\`\`\`
import { helper } from './utils/helper';
console.log(helper());
\`\`\`

When complete, end with: RALPH_COMPLETE
`;

    return {
      success: true,
      tier: this.tier,
      message: "Applied format guidance with concrete examples",
      modifiedContext: {
        systemPrompt: formatInstructions,
      },
    };
  }
}

/**
 * Tier 2: Simplified Prompts
 * Breaks complex tasks into single-file changes.
 */
export class SimplifiedPromptStrategy extends RecoveryStrategy {
  tier: RecoveryTier = "simplified_prompt";

  async execute(
    context: RecoveryContext,
    loopContext: {
      taskDescription: string;
      planContent: string;
      workingDir: string;
    },
    client: AIClient,
  ): Promise<RecoveryResult> {
    // Extract most critical file from plan
    const focusFile = await this.identifyFocusFile(
      loopContext.planContent,
      loopContext.taskDescription,
      client,
    );

    const simplifiedPrompt = `
SIMPLIFIED TASK: Focus on ONE file only.

FILE TO MODIFY: ${focusFile || "the most critical file for this task"}

Your ONLY job: Modify this single file to accomplish the core requirement.

Ignore all other files. Do not create new files. Do not modify anything else.

Provide the complete modified file content using this format:

\`\`\`
FILE: ${focusFile || "path/to/file.ts"}
\`\`\`
// Complete file content here
\`\`\`

When done, output: RALPH_COMPLETE
`;

    return {
      success: true,
      tier: this.tier,
      message: `Simplified to single-file focus${focusFile ? `: ${focusFile}` : ""}`,
      modifiedContext: {
        systemPrompt: simplifiedPrompt,
        focusFiles: focusFile ? [focusFile] : [],
      },
    };
  }

  private async identifyFocusFile(
    plan: string,
    task: string,
    client: AIClient,
  ): Promise<string | null> {
    try {
      const prompt = `Given this task plan, identify the SINGLE most critical file to modify.

PLAN:
${plan}

TASK:
${task}

Respond with ONLY the file path, nothing else. Example: "src/components/Header.tsx"`;

      const response = await client.chat([{ role: "user", content: prompt }]);
      const filePath = response.trim().split("\n")[0].replace(/[`'"]/g, "");

      // Validate it looks like a file path
      if (filePath.includes("/") || filePath.includes(".")) {
        return filePath;
      }

      return null;
    } catch (error) {
      console.warn("Failed to identify focus file:", error);
      return null;
    }
  }
}

/**
 * Tier 3: Context Reset
 * Clears conversation history and starts fresh with minimal context.
 */
export class ContextResetStrategy extends RecoveryStrategy {
  tier: RecoveryTier = "context_reset";

  async execute(
    context: RecoveryContext,
    loopContext: {
      taskDescription: string;
      planContent: string;
      workingDir: string;
    },
  ): Promise<RecoveryResult> {
    const resetPrompt = `
FRESH START - Previous attempts encountered issues. Starting clean.

TASK: ${loopContext.taskDescription}

KEY REQUIREMENTS FROM PLAN:
${this.extractKeyRequirements(loopContext.planContent)}

Approach this task step-by-step:
1. Read necessary files
2. Make minimal, focused changes
3. Provide complete file content in proper format
4. Output RALPH_COMPLETE when done

Format for file changes:

\`\`\`
FILE: path/to/file.ts
\`\`\`
// Complete file content
\`\`\`

Stay focused. Ignore previous conversation. Complete this task.
`;

    return {
      success: true,
      tier: this.tier,
      message: "Reset conversation context to break repetition cycle",
      modifiedContext: {
        systemPrompt: resetPrompt,
        conversationHistory: [], // Clear history
      },
    };
  }

  private extractKeyRequirements(plan: string): string {
    // Extract first 3 bullet points or first 500 chars of plan
    const lines = plan.split("\n");
    const bulletPoints = lines.filter(
      (line) => line.trim().startsWith("-") || line.trim().startsWith("*"),
    );

    if (bulletPoints.length > 0) {
      return bulletPoints.slice(0, 3).join("\n");
    }

    return plan.substring(0, 500) + (plan.length > 500 ? "..." : "");
  }
}

/**
 * Tier 4: Manual Fallback
 * Generates step-by-step instructions for user to complete task manually.
 */
export class ManualFallbackStrategy extends RecoveryStrategy {
  tier: RecoveryTier = "manual_fallback";

  async execute(
    context: RecoveryContext,
    loopContext: {
      taskDescription: string;
      planContent: string;
      workingDir: string;
    },
    client: AIClient,
  ): Promise<RecoveryResult> {
    const manualSteps = await this.generateManualSteps(
      loopContext.taskDescription,
      loopContext.planContent,
      context.previousErrors,
      client,
    );

    return {
      success: false, // Indicates manual intervention needed
      tier: this.tier,
      message: "Automatic recovery exhausted. Manual steps generated for user.",
      manualSteps,
    };
  }

  private async generateManualSteps(
    task: string,
    plan: string,
    errors: string[],
    client: AIClient,
  ): Promise<string[]> {
    try {
      const prompt = `The AI agent failed to complete this task after multiple recovery attempts.

TASK: ${task}

PLAN: ${plan}

ERRORS ENCOUNTERED:
${errors.join("\n")}

Generate a step-by-step checklist for a human developer to complete this task manually.
Each step should be actionable and specific.

Format as numbered list:
1. First step
2. Second step
etc.`;

      const response = await client.chat([{ role: "user", content: prompt }]);

      // Extract numbered steps
      const steps = response
        .split("\n")
        .filter((line) => /^\d+\./.test(line.trim()))
        .map((line) => line.replace(/^\d+\.\s*/, "").trim());

      if (steps.length === 0) {
        // Fallback: basic steps
        return [
          "Review the task description and plan",
          "Identify files that need modification",
          "Make necessary code changes",
          "Test the changes locally",
          "Commit and push to branch",
        ];
      }

      return steps;
    } catch (error) {
      console.warn("Failed to generate manual steps:", error);
      return [
        "Review the task description and plan",
        "Check agent logs for specific errors",
        "Complete the implementation manually",
        "Run tests to verify correctness",
        "Commit changes when ready",
      ];
    }
  }
}

/**
 * Recovery Orchestrator
 * Manages tier progression and recovery attempts.
 */
export class RecoveryOrchestrator {
  private strategies: Map<RecoveryTier, RecoveryStrategy>;
  private nextRecommendedStrategy?: RecoveryTier;

  constructor() {
    this.strategies = new Map<RecoveryTier, RecoveryStrategy>([
      ["format_guidance", new FormatGuidanceStrategy()],
      ["simplified_prompt", new SimplifiedPromptStrategy()],
      ["context_reset", new ContextResetStrategy()],
      ["manual_fallback", new ManualFallbackStrategy()],
    ] as const);
  }

  /**
   * Attempts recovery using specified tier.
   * Automatically escalates to next tier if recovery fails.
   */
  async attemptRecovery(
    context: RecoveryContext,
    loopContext: {
      taskDescription: string;
      planContent: string;
      workingDir: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    },
    client: AIClient,
  ): Promise<RecoveryResult> {
    const strategy = this.strategies.get(context.tier);
    if (!strategy) {
      throw new Error(`Unknown recovery tier: ${context.tier}`);
    }

    const result = await strategy.execute(context, loopContext, client);

    // If recovery failed and not at final tier, escalate
    if (!result.success && context.tier !== "manual_fallback") {
      const nextTier = this.nextTier(context.tier);
      return this.attemptRecovery(
        {
          ...context,
          tier: nextTier,
          attemptNumber: context.attemptNumber + 1,
        },
        loopContext,
        client,
      );
    }

    return result;
  }

  /**
   * Gets next tier in escalation sequence.
   */
  private nextTier(current: RecoveryTier): RecoveryTier {
    const sequence: RecoveryTier[] = [
      "format_guidance",
      "simplified_prompt",
      "context_reset",
      "manual_fallback",
    ];

    const currentIndex = sequence.indexOf(current);
    if (currentIndex === -1 || currentIndex === sequence.length - 1) {
      return "manual_fallback";
    }

    return sequence[currentIndex + 1];
  }

  /**
   * Sets next recommended strategy (used by enhanced extraction).
   */
  setNextStrategy(tier: RecoveryTier): void {
    this.nextRecommendedStrategy = tier;
  }

  /**
   * Gets recommended tier based on signals and extraction quality.
   */
  getRecommendedTier(signals: StuckSignal[]): RecoveryTier {
    if (this.nextRecommendedStrategy) {
      const recommended = this.nextRecommendedStrategy;
      this.nextRecommendedStrategy = undefined; // Clear after use
      return recommended;
    }

    // Analyze signals to recommend tier
    const hasRepeatedPattern = signals.some(
      (s) => s.type === "repeated_pattern",
    );
    const hasQualityDegradation = signals.some(
      (s) => s.type === "quality_degradation",
    );
    const hasTimeout = signals.some((s) => s.type === "iteration_timeout");

    if (hasTimeout) return "simplified_prompt"; // Reduce scope
    if (hasRepeatedPattern) return "context_reset"; // Break cycle
    if (hasQualityDegradation) return "simplified_prompt"; // Focus

    return "format_guidance"; // Default: start with guidance
  }
}
