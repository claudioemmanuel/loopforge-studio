/**
 * AI Execution Domain Types
 *
 * Value objects and types for the AI Execution context.
 */

/**
 * Execution status
 */
export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Extraction strategy
 */
export type ExtractionStrategy =
  | "strict" // Regex for well-formatted blocks
  | "fuzzy" // Looser patterns
  | "ai-json" // Structured JSON
  | "ai-single-file" // One file at a time
  | "ai-code-mapping" // File paths + descriptions
  | "ai-assisted"; // Legacy fallback

/**
 * Extraction result
 */
export interface ExtractionResult {
  files: ExtractedFile[];
  strategy: ExtractionStrategy;
  confidence: number; // 0-1
  fallbackUsed: boolean;
}

/**
 * Extracted file
 */
export interface ExtractedFile {
  path: string;
  content: string;
  language?: string;
}

/**
 * Stuck signal type
 */
export type StuckSignalType =
  | "consecutive_errors"
  | "repeated_patterns"
  | "timeout"
  | "quality_degradation"
  | "no_progress";

/**
 * Stuck signal severity
 */
export type StuckSignalSeverity = "low" | "medium" | "high" | "critical";

/**
 * Stuck signal
 */
export interface StuckSignal {
  type: StuckSignalType;
  severity: StuckSignalSeverity;
  details: Record<string, unknown>;
  detectedAt: Date;
}

/**
 * Recovery tier (progressive escalation)
 */
export type RecoveryTier = 1 | 2 | 3 | 4;

/**
 * Recovery strategy
 */
export type RecoveryStrategy =
  | "format_guidance" // Tier 1: Concrete examples
  | "simplified_prompts" // Tier 2: Single-file focus
  | "context_reset" // Tier 3: Fresh start with minimal context
  | "manual_fallback"; // Tier 4: Step-by-step instructions for user

/**
 * Recovery attempt
 */
export interface RecoveryAttempt {
  tier: RecoveryTier;
  strategy: RecoveryStrategy;
  startedAt: Date;
  completedAt?: Date;
  succeeded: boolean;
  error?: string;
}

/**
 * Validation check result
 */
export interface ValidationCheckResult {
  passed: boolean;
  score: number; // 0-100
  weight: number; // Contribution to overall score
  details?: string;
}

/**
 * Validation report
 */
export interface ValidationReport {
  score: number; // 0-100 (weighted average)
  passed: boolean; // score >= 80
  checks: {
    hasMarker: ValidationCheckResult; // 20% - RALPH_COMPLETE found
    hasCommits: ValidationCheckResult; // 20% - commits.length > 0
    matchesPlan: ValidationCheckResult; // 30% - ≥50% file coverage
    qualityThreshold: ValidationCheckResult; // 15% - 1-10k lines changed
    testsExecuted: ValidationCheckResult; // 5% - test artifacts present
    noCriticalErrors: ValidationCheckResult; // 10% - no CRITICAL_ERROR
  };
  generatedAt: Date;
}

/**
 * Iteration (single Ralph loop cycle)
 */
export interface Iteration {
  number: number;
  startedAt: Date;
  completedAt?: Date;
  thoughts: string[];
  actions: string[];
  filesExtracted: number;
  error?: string;
}

/**
 * Commit info
 */
export interface CommitInfo {
  hash: string;
  message: string;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  timestamp: Date;
}

/**
 * Execution configuration
 */
export interface ExecutionConfiguration {
  maxIterations: number; // Default: 50
  iterationTimeout: number; // Default: 10 minutes
  enableStuckDetection: boolean; // Default: true
  enableRecovery: boolean; // Default: true
  enableCompletionValidation: boolean; // Default: true
  enableSkills: boolean; // Default: true
}

/**
 * Default execution configuration
 */
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfiguration = {
  maxIterations: 50,
  iterationTimeout: 600000, // 10 minutes
  enableStuckDetection: true,
  enableRecovery: true,
  enableCompletionValidation: true,
  enableSkills: true,
};

/**
 * Recovery tier thresholds
 */
export const RECOVERY_TIERS: Record<
  RecoveryTier,
  { strategy: RecoveryStrategy; maxAttempts: number }
> = {
  1: { strategy: "format_guidance", maxAttempts: 3 },
  2: { strategy: "simplified_prompts", maxAttempts: 3 },
  3: { strategy: "context_reset", maxAttempts: 2 },
  4: { strategy: "manual_fallback", maxAttempts: 1 },
};

/**
 * Validation check weights
 */
export const VALIDATION_WEIGHTS = {
  hasMarker: 20,
  hasCommits: 20,
  matchesPlan: 30,
  qualityThreshold: 15,
  testsExecuted: 5,
  noCriticalErrors: 10,
};

/**
 * Passing threshold for validation
 */
export const VALIDATION_PASSING_THRESHOLD = 80;
