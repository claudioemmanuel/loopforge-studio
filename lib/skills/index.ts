/**
 * Skills System
 *
 * Central exports for the Loopforge skills framework.
 */

// Types
export type {
  SkillDefinition,
  SkillInvocationContext,
  SkillInvocationOptions,
  SkillResult,
  SkillExecution,
  SkillExecuteLogic,
  SkillEnforcement,
  SkillCategory,
  TaskPhase,
  SkillStatus,
  SkillRegistryEntry,
} from "./types";

// Registry
export {
  registerSkill,
  unregisterSkill,
  getSkill,
  getAllSkills,
  getSkillsByCategory,
  getSkillsForPhase,
  isSkillEnabled,
  setSkillEnabled,
  getSkillStats,
  clearRegistry,
} from "./registry";

// Loader
export { invokeSkill, invokeSkills, clearSkillCache } from "./loader";

// Invoker
export {
  invokePhaseSkills,
  getRecommendedSkills,
  canTransitionPhase,
  augmentSystemPrompt,
} from "./invoker";

// Core skills
export { testDrivenDevelopment } from "./core/test-driven-development";
export { systematicDebugging } from "./core/systematic-debugging";
export { verificationBeforeCompletion } from "./core/verification-before-completion";
export { brainstorming } from "./core/brainstorming";
export { writingPlans } from "./core/writing-plans";
export { usingSuperpowers } from "./core/using-superpowers";

// Loopforge skills
export { autonomousCodeGeneration } from "./loopforge/autonomous-code-generation";
export { multiAgentCoordination } from "./loopforge/multi-agent-coordination";
export { gitWorkflowAutomation } from "./loopforge/git-workflow-automation";
export { contextAccumulation } from "./loopforge/context-accumulation";
export { promptEngineering } from "./loopforge/prompt-engineering";

// Initialization
import { testDrivenDevelopment } from "./core/test-driven-development";
import { systematicDebugging } from "./core/systematic-debugging";
import { verificationBeforeCompletion } from "./core/verification-before-completion";
import { brainstorming } from "./core/brainstorming";
import { writingPlans } from "./core/writing-plans";
import { usingSuperpowers } from "./core/using-superpowers";
import { autonomousCodeGeneration } from "./loopforge/autonomous-code-generation";
import { multiAgentCoordination } from "./loopforge/multi-agent-coordination";
import { gitWorkflowAutomation } from "./loopforge/git-workflow-automation";
import { contextAccumulation } from "./loopforge/context-accumulation";
import { promptEngineering } from "./loopforge/prompt-engineering";
import { registerSkill } from "./registry";

/**
 * Initialize all skills in the registry
 * Should be called once at application startup
 */
export function initializeSkills(): void {
  // Core Superpowers skills
  registerSkill(testDrivenDevelopment, {
    featureFlag: "ENABLE_SKILL_TDD",
  });

  registerSkill(systematicDebugging, {
    featureFlag: "ENABLE_SKILL_DEBUGGING",
  });

  registerSkill(verificationBeforeCompletion, {
    featureFlag: "ENABLE_SKILL_VERIFICATION",
  });

  registerSkill(brainstorming, {
    featureFlag: "ENABLE_SKILL_BRAINSTORMING",
  });

  registerSkill(writingPlans, {
    featureFlag: "ENABLE_SKILL_WRITING_PLANS",
  });

  registerSkill(usingSuperpowers, {
    featureFlag: "ENABLE_SKILL_USING_SUPERPOWERS",
  });

  // Loopforge-specific skills
  registerSkill(autonomousCodeGeneration, {
    featureFlag: "ENABLE_SKILL_AUTONOMOUS_CODEGEN",
  });

  registerSkill(multiAgentCoordination, {
    featureFlag: "ENABLE_SKILL_MULTI_AGENT",
  });

  registerSkill(gitWorkflowAutomation, {
    featureFlag: "ENABLE_SKILL_GIT_WORKFLOW",
  });

  registerSkill(contextAccumulation, {
    featureFlag: "ENABLE_SKILL_CONTEXT_ACCUMULATION",
  });

  registerSkill(promptEngineering, {
    featureFlag: "ENABLE_SKILL_PROMPT_ENGINEERING",
  });

  console.log("[Skills] Initialized 11 skills (6 core + 5 Loopforge)");
}

/**
 * Check if skills system is enabled globally
 */
export function isSkillsSystemEnabled(): boolean {
  const enabled = process.env.ENABLE_SKILLS_SYSTEM;
  return enabled !== "false" && enabled !== "0";
}
