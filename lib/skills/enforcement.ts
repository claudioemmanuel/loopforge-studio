/**
 * Skill Enforcement Helpers
 *
 * Utilities for applying skill results, handling blocking/warning/guidance enforcement,
 * and persisting skill execution history.
 */

import type {
  SkillResult,
  SkillExecution,
  SkillInvocationContext,
} from "./types";
import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Convert SkillResult to SkillExecution (for database storage)
 */
export function skillResultToExecution(result: SkillResult): SkillExecution {
  return {
    skillId: result.skillId,
    status: result.status,
    message: result.message,
    timestamp: result.timestamp.toISOString(),
    metadata: result.metadata,
  };
}

/**
 * Persist skill execution to database
 */
export async function persistSkillExecution(
  executionId: string,
  result: SkillResult,
): Promise<void> {
  try {
    // Fetch current skill executions
    const [execution] = await db
      .select({ skillExecutions: executions.skillExecutions })
      .from(executions)
      .where(eq(executions.id, executionId));

    if (!execution) {
      console.warn(
        `[Skills] Execution ${executionId} not found, cannot persist skill execution`,
      );
      return;
    }

    const currentExecutions =
      (execution.skillExecutions as SkillExecution[]) || [];

    // Append new execution
    const updatedExecutions = [
      ...currentExecutions,
      skillResultToExecution(result),
    ];

    // Update database
    await db
      .update(executions)
      .set({
        skillExecutions:
          updatedExecutions as typeof executions.$inferInsert.skillExecutions,
      })
      .where(eq(executions.id, executionId));

    console.log(
      `[Skills] Persisted ${result.skillId} execution for ${executionId}`,
    );
  } catch (error) {
    console.error(`[Skills] Failed to persist skill execution:`, error);
  }
}

/**
 * Check if any skill results block progression
 */
export function hasBlockingResults(results: SkillResult[]): boolean {
  return results.some((r) => r.status === "blocked");
}

/**
 * Get blocking results
 */
export function getBlockingResults(results: SkillResult[]): SkillResult[] {
  return results.filter((r) => r.status === "blocked");
}

/**
 * Get warning results
 */
export function getWarningResults(results: SkillResult[]): SkillResult[] {
  return results.filter((r) => r.status === "warning");
}

/**
 * Combine augmented prompts from multiple skill results
 */
export function combineAugmentedPrompts(
  basePrompt: string,
  results: SkillResult[],
): string {
  const augmentedPrompts = results
    .filter((r) => r.augmentedPrompt)
    .map((r) => r.augmentedPrompt!);

  if (augmentedPrompts.length === 0) {
    return basePrompt;
  }

  return `${basePrompt}\n\n# Skills Guidance\n\n${augmentedPrompts.join("\n\n---\n\n")}`;
}

/**
 * Combine recommendations from multiple skill results
 */
export function combineRecommendations(results: SkillResult[]): string[] {
  const allRecommendations: string[] = [];

  for (const result of results) {
    if (result.recommendations && result.recommendations.length > 0) {
      allRecommendations.push(`## ${result.skillId}`);
      allRecommendations.push(...result.recommendations);
      allRecommendations.push(""); // Add blank line
    }
  }

  return allRecommendations;
}

/**
 * Create summary message from skill results
 */
export function createSkillResultsSummary(results: SkillResult[]): string {
  if (results.length === 0) {
    return "No skills executed";
  }

  const passed = results.filter((r) => r.status === "passed").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const blocked = results.filter((r) => r.status === "blocked").length;

  const parts: string[] = [];

  if (passed > 0) parts.push(`${passed} passed`);
  if (warnings > 0) parts.push(`${warnings} warnings`);
  if (blocked > 0) parts.push(`${blocked} blocked`);

  return `Skills: ${parts.join(", ")}`;
}

/**
 * Apply skill results to context (modify context based on skill guidance)
 */
export function applySkillResultsToContext(
  context: SkillInvocationContext,
  results: SkillResult[],
): SkillInvocationContext {
  // Add skill executions to context
  const skillExecutions = results.map(skillResultToExecution);

  return {
    ...context,
    previousSkillExecutions: [
      ...(context.previousSkillExecutions || []),
      ...skillExecutions,
    ],
  };
}

/**
 * Check if skill should be bypassed based on context
 */
export function shouldBypassSkill(
  skillId: string,
  context: SkillInvocationContext,
): boolean {
  // Check if skills system is globally disabled
  if (process.env.ENABLE_SKILLS_SYSTEM === "false") {
    return true;
  }

  // Check if skill has already been executed recently
  const recentExecutions = context.previousSkillExecutions || [];
  const recentExecution = recentExecutions.find((e) => e.skillId === skillId);

  // If skill passed recently (within same iteration), skip
  if (
    recentExecution &&
    recentExecution.status === "passed" &&
    context.iteration !== undefined
  ) {
    // Allow re-execution after iteration change
    const executionIteration = recentExecution.metadata?.iteration as
      | number
      | undefined;
    if (executionIteration === context.iteration) {
      return true; // Skip if already passed in same iteration
    }
  }

  return false;
}

/**
 * Format skill result for display (markdown)
 */
export function formatSkillResult(result: SkillResult): string {
  const statusEmoji = {
    passed: "✓",
    warning: "⚠",
    blocked: "✗",
  }[result.status];

  let output = `${statusEmoji} **${result.skillId}**: ${result.message}\n`;

  if (result.recommendations && result.recommendations.length > 0) {
    output += "\nRecommendations:\n";
    for (const rec of result.recommendations) {
      output += `- ${rec}\n`;
    }
  }

  return output;
}

/**
 * Create error response for blocked skill
 */
export function createBlockedResponse(result: SkillResult): {
  error: string;
  details: string[];
} {
  return {
    error: `Blocked by ${result.skillId}: ${result.message}`,
    details: result.recommendations || [],
  };
}
