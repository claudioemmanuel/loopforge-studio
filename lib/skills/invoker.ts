/**
 * Skill Invoker
 *
 * Automatic skill triggering based on Kanban phase transitions.
 * This module determines which skills should run at each phase and orchestrates their execution.
 */

import type { AIClient } from "@/lib/ai/client";
import type { SkillInvocationContext, SkillResult, TaskPhase } from "./types";
import { getSkillsForPhase } from "./registry";
import { invokeSkill } from "./loader";

/**
 * Invoke all skills appropriate for a given phase
 */
export async function invokePhaseSkills(
  phase: TaskPhase,
  context: SkillInvocationContext,
  client: AIClient,
): Promise<SkillResult[]> {
  const skills = getSkillsForPhase(phase);

  if (skills.length === 0) {
    console.log(`[Skills] No skills configured for phase: ${phase}`);
    return [];
  }

  console.log(
    `[Skills] Triggering ${skills.length} skills for phase ${phase}: ${skills.map((s) => s.id).join(", ")}`,
  );

  const results: SkillResult[] = [];

  // Execute skills in order (respecting blocking)
  for (const skill of skills) {
    const result = await invokeSkill(skill.id, context, client);

    if (result) {
      results.push(result);

      // If skill blocks, stop execution chain
      if (result.status === "blocked") {
        console.log(`[Skills] Phase ${phase} blocked by skill: ${skill.id}`);
        break;
      }
    }
  }

  return results;
}

/**
 * Get recommended skills for a given phase (without executing)
 */
export function getRecommendedSkills(phase: TaskPhase): string[] {
  const phaseSkillMap: Record<TaskPhase, string[]> = {
    todo: [],
    brainstorming: ["using-superpowers", "brainstorming"],
    planning: [
      "using-superpowers",
      "writing-plans",
      "context-accumulation",
      "prompt-engineering",
    ],
    ready: [],
    executing: [
      "using-superpowers",
      "test-driven-development",
      "autonomous-code-generation",
      "git-workflow-automation",
    ],
    review: ["verification-before-completion"],
    done: [],
    stuck: ["systematic-debugging"],
  };

  return phaseSkillMap[phase] || [];
}

/**
 * Check if any blocking skills would prevent phase transition
 */
export async function canTransitionPhase(
  fromPhase: TaskPhase,
  toPhase: TaskPhase,
  context: SkillInvocationContext,
  client: AIClient,
): Promise<{ allowed: boolean; blockingSkill?: string; reason?: string }> {
  // Get skills for target phase
  const skills = getSkillsForPhase(toPhase);

  // No skills = no restrictions
  if (skills.length === 0) {
    return { allowed: true };
  }

  // Check each blocking skill
  for (const skill of skills) {
    if (skill.enforcement !== "blocking") {
      continue;
    }

    const result = await invokeSkill(skill.id, context, client, {
      forceExecution: true,
    });

    if (result && result.status === "blocked") {
      return {
        allowed: false,
        blockingSkill: skill.id,
        reason: result.message,
      };
    }
  }

  return { allowed: true };
}

/**
 * Augment system prompt with guidance from applicable skills
 */
export function augmentSystemPrompt(
  basePrompt: string,
  phase: TaskPhase,
): string {
  const skills = getSkillsForPhase(phase).filter(
    (s) => s.enforcement === "guidance",
  );

  if (skills.length === 0) {
    return basePrompt;
  }

  const skillPrompts = skills
    .map((skill) => {
      return `## ${skill.name}\n\n${skill.systemPrompt}`;
    })
    .join("\n\n");

  return `${basePrompt}\n\n# Skills Guidance\n\n${skillPrompts}`;
}
