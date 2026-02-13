/**
 * Feature flags configuration
 * Controls experimental and phased features
 */

export const FeatureFlags = {
  /**
   * Enable agent orchestration system
   * Phase 1: Foundation only (database, services, sample agents)
   * When enabled, agents will be triggered at appropriate workflow stages
   */
  AGENT_ORCHESTRATION: process.env.ENABLE_AGENT_ORCHESTRATION === 'true',
} as const

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FeatureFlags): boolean {
  return FeatureFlags[feature]
}
