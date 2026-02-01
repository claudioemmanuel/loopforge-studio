/**
 * Skill Loader
 *
 * Handles dynamic skill loading and invocation with timeout, caching, and error handling.
 */

import type { AIClient } from "@/lib/ai/client";
import type {
  SkillInvocationContext,
  SkillInvocationOptions,
  SkillResult,
  SkillDefinition,
} from "./types";
import { getSkill, isSkillEnabled } from "./registry";

/**
 * Cache for skill results (in-memory, per-process)
 */
const skillResultCache = new Map<string, SkillResult>();

/**
 * Generate cache key for skill invocation
 */
function getCacheKey(skillId: string, context: SkillInvocationContext): string {
  return `${skillId}:${context.taskId}:${context.phase}:${context.iteration || 0}`;
}

/**
 * Invoke a skill with the given context
 */
export async function invokeSkill(
  skillId: string,
  context: SkillInvocationContext,
  client: AIClient,
  options: SkillInvocationOptions = {},
): Promise<SkillResult | null> {
  const {
    cacheResults = false,
    timeout = 30000,
    forceExecution = false,
    additionalContext = {},
  } = options;

  // Check if skill exists and is enabled
  const skill = getSkill(skillId);
  if (!skill) {
    console.warn(`[Skills] Skill not found: ${skillId}`);
    return null;
  }

  if (!isSkillEnabled(skillId) && !forceExecution) {
    console.log(`[Skills] Skill disabled: ${skillId}`);
    return null;
  }

  // Check phase trigger (unless forced)
  if (!forceExecution && !skill.triggerPhases.includes(context.phase)) {
    console.log(
      `[Skills] Skill ${skillId} not triggered for phase ${context.phase}`,
    );
    return null;
  }

  // Check cache if enabled
  const cacheKey = getCacheKey(skillId, context);
  if (cacheResults && skillResultCache.has(cacheKey)) {
    const cached = skillResultCache.get(cacheKey)!;
    console.log(`[Skills] Using cached result for ${skillId}`);
    return cached;
  }

  // Merge additional context
  const mergedContext = { ...context, ...additionalContext };

  console.log(
    `[Skills] Invoking skill: ${skill.name} (${skillId}) for phase ${context.phase}`,
  );

  try {
    // Execute with timeout
    const result = await Promise.race([
      skill.executeLogic(mergedContext, client),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Skill execution timeout")), timeout),
      ),
    ]);

    // Cache if enabled and successful
    if (cacheResults && result.status === "passed") {
      skillResultCache.set(cacheKey, result);
    }

    logSkillResult(skill, result);
    return result;
  } catch (error) {
    console.error(`[Skills] Error executing skill ${skillId}:`, error);

    return {
      skillId,
      status: "warning",
      message: `Skill execution failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Invoke multiple skills in sequence
 */
export async function invokeSkills(
  skillIds: string[],
  context: SkillInvocationContext,
  client: AIClient,
  options: SkillInvocationOptions = {},
): Promise<SkillResult[]> {
  const results: SkillResult[] = [];

  for (const skillId of skillIds) {
    const result = await invokeSkill(skillId, context, client, options);
    if (result) {
      results.push(result);

      // Stop on blocking result
      if (result.status === "blocked") {
        console.log(
          `[Skills] Stopping skill chain due to blocking result from ${skillId}`,
        );
        break;
      }
    }
  }

  return results;
}

/**
 * Clear skill result cache
 */
export function clearSkillCache(): void {
  skillResultCache.clear();
}

/**
 * Log skill result for debugging
 */
function logSkillResult(skill: SkillDefinition, result: SkillResult): void {
  const statusEmoji = {
    passed: "✓",
    warning: "⚠",
    blocked: "✗",
  }[result.status];

  console.log(
    `[Skills] ${statusEmoji} ${skill.name}: ${result.status.toUpperCase()} - ${result.message}`,
  );

  if (result.recommendations?.length) {
    console.log(
      `[Skills]   Recommendations: ${result.recommendations.join(", ")}`,
    );
  }
}
