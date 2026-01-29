/**
 * Feature Flags for Ralph Loop Reliability Improvements
 *
 * Enables progressive rollout of reliability features with graceful degradation.
 *
 * Part of Ralph Loop Reliability Improvements (2026-01-29)
 */

export interface FeatureFlags {
  /**
   * Enable multi-signal stuck detection.
   * When false, uses legacy consecutive error counting.
   * @default false
   */
  ENABLE_STUCK_DETECTOR: boolean;

  /**
   * Enable progressive error recovery (4-tier system).
   * When false, no recovery attempts are made (tasks go to stuck immediately).
   * @default false
   */
  ENABLE_RECOVERY_STRATEGIES: boolean;

  /**
   * Enable completion validation with plan matching.
   * When false, uses legacy validation (RALPH_COMPLETE + commits > 0).
   * @default false
   */
  ENABLE_COMPLETION_VALIDATION: boolean;

  /**
   * Enable enhanced extraction with progressive strategies.
   * When false, uses existing smart-extractor logic.
   * @default false
   */
  ENABLE_ENHANCED_EXTRACTION: boolean;

  /**
   * Enable test gate enforcement.
   * When false, tests run but don't block PR creation.
   * @default false
   */
  ENABLE_TEST_GATES: boolean;

  /**
   * Enable A/B testing framework UI.
   * When false, experiments page and navigation are hidden.
   * @default false
   */
  ENABLE_AB_TESTING: boolean;
}

/**
 * Parses boolean environment variable.
 * Accepts: true, 1, yes, on (case-insensitive)
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;

  const normalized = value.toLowerCase().trim();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

/**
 * Loads feature flags from environment variables.
 */
export function loadFeatureFlags(): FeatureFlags {
  return {
    ENABLE_STUCK_DETECTOR: parseBoolean(
      process.env.ENABLE_STUCK_DETECTOR,
      false,
    ),
    ENABLE_RECOVERY_STRATEGIES: parseBoolean(
      process.env.ENABLE_RECOVERY_STRATEGIES,
      false,
    ),
    ENABLE_COMPLETION_VALIDATION: parseBoolean(
      process.env.ENABLE_COMPLETION_VALIDATION,
      false,
    ),
    ENABLE_ENHANCED_EXTRACTION: parseBoolean(
      process.env.ENABLE_ENHANCED_EXTRACTION,
      false,
    ),
    ENABLE_TEST_GATES: parseBoolean(process.env.ENABLE_TEST_GATES, false),
    ENABLE_AB_TESTING: parseBoolean(process.env.ENABLE_AB_TESTING, false),
  };
}

/**
 * Singleton instance of feature flags.
 * Loaded once at module initialization.
 */
const featureFlags = loadFeatureFlags();

/**
 * Gets value of a specific feature flag.
 *
 * @example
 * if (getFeatureFlag('ENABLE_STUCK_DETECTOR')) {
 *   detector = new StuckDetector(config);
 * } else {
 *   detector = new LegacyStuckChecker(threshold);
 * }
 */
export function getFeatureFlag(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}

/**
 * Gets all feature flags.
 * Useful for logging/debugging.
 */
export function getAllFeatureFlags(): Readonly<FeatureFlags> {
  return { ...featureFlags };
}

/**
 * Checks if any reliability features are enabled.
 * Useful for conditional initialization.
 */
export function areReliabilityFeaturesEnabled(): boolean {
  return (
    featureFlags.ENABLE_STUCK_DETECTOR ||
    featureFlags.ENABLE_RECOVERY_STRATEGIES ||
    featureFlags.ENABLE_COMPLETION_VALIDATION ||
    featureFlags.ENABLE_ENHANCED_EXTRACTION ||
    featureFlags.ENABLE_TEST_GATES
  );
}

/**
 * Gets human-readable status of all feature flags.
 * Useful for startup logs.
 */
export function getFeatureFlagStatus(): string {
  const flags = getAllFeatureFlags();
  const entries = Object.entries(flags).map(
    ([key, value]) => `  ${key}: ${value ? "✓ enabled" : "✗ disabled"}`,
  );

  return `Feature Flags:\n${entries.join("\n")}`;
}

// Log feature flag status on initialization (only in development)
if (process.env.NODE_ENV === "development") {
  console.log(`\n${getFeatureFlagStatus()}\n`);
}
