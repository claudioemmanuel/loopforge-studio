/**
 * Skills Registry
 *
 * Central registry for all available skills in the Loopforge system.
 * Provides lookup, filtering, and management capabilities.
 */

import type {
  SkillDefinition,
  SkillCategory,
  TaskPhase,
  SkillRegistryEntry,
} from "./types";

/**
 * Global skills registry
 */
const skillsRegistry = new Map<string, SkillRegistryEntry>();

/**
 * Register a skill in the global registry
 */
export function registerSkill(
  skill: SkillDefinition,
  options: { enabled?: boolean; featureFlag?: string } = {},
): void {
  const { enabled = true, featureFlag } = options;

  skillsRegistry.set(skill.id, {
    skill,
    enabled,
    featureFlag,
  });
}

/**
 * Unregister a skill from the global registry
 */
export function unregisterSkill(skillId: string): boolean {
  return skillsRegistry.delete(skillId);
}

/**
 * Get a skill by ID
 */
export function getSkill(skillId: string): SkillDefinition | null {
  const entry = skillsRegistry.get(skillId);
  return entry && entry.enabled ? entry.skill : null;
}

/**
 * Get all registered skills
 */
export function getAllSkills(): SkillDefinition[] {
  return Array.from(skillsRegistry.values())
    .filter((entry) => entry.enabled)
    .map((entry) => entry.skill);
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(
  category: SkillCategory,
): SkillDefinition[] {
  return getAllSkills().filter((skill) => skill.category === category);
}

/**
 * Get skills that should trigger for a specific phase
 */
export function getSkillsForPhase(phase: TaskPhase): SkillDefinition[] {
  return getAllSkills().filter((skill) => skill.triggerPhases.includes(phase));
}

/**
 * Check if a skill is enabled (considering feature flags)
 */
export function isSkillEnabled(skillId: string): boolean {
  const entry = skillsRegistry.get(skillId);

  if (!entry || !entry.enabled) {
    return false;
  }

  // Check feature flag if defined
  if (entry.featureFlag) {
    const flagValue = process.env[entry.featureFlag];
    return flagValue !== "false" && flagValue !== "0";
  }

  return true;
}

/**
 * Enable or disable a skill
 */
export function setSkillEnabled(skillId: string, enabled: boolean): boolean {
  const entry = skillsRegistry.get(skillId);

  if (!entry) {
    return false;
  }

  entry.enabled = enabled;
  return true;
}

/**
 * Get skill statistics
 */
export function getSkillStats() {
  const all = Array.from(skillsRegistry.values());
  const enabled = all.filter((e) => e.enabled);

  return {
    total: all.length,
    enabled: enabled.length,
    disabled: all.length - enabled.length,
    byCategory: enabled.reduce(
      (acc, entry) => {
        const category = entry.skill.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<SkillCategory, number>,
    ),
    byEnforcement: enabled.reduce(
      (acc, entry) => {
        const enforcement = entry.skill.enforcement;
        acc[enforcement] = (acc[enforcement] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}

/**
 * Clear all registered skills (for testing)
 */
export function clearRegistry(): void {
  skillsRegistry.clear();
}
