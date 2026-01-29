/**
 * Multi-Signal Stuck Detection for Ralph Loop
 *
 * Replaces simple consecutive error counting with intelligent pattern analysis.
 * Detects stuck states using 5 signals: consecutive errors, repeated patterns,
 * iteration timeouts, quality degradation, and no progress.
 *
 * Part of Ralph Loop Reliability Improvements (2026-01-29)
 */

type StuckSignalType =
  | "consecutive_errors"
  | "repeated_pattern"
  | "iteration_timeout"
  | "quality_degradation"
  | "no_progress";

type Severity = "low" | "medium" | "high" | "critical";

export interface StuckSignal {
  type: StuckSignalType;
  severity: Severity;
  confidence: number; // 0-1
  evidence: string;
  metadata?: Record<string, unknown>;
}

export interface StuckDetectorConfig {
  maxConsecutiveErrors: number; // Default: 3
  iterationTimeoutMinutes: number; // Default: 10
  progressCommitThreshold: number; // Default: 3 iterations
  patternRepetitionThreshold: number; // Default: 2
  qualityDegradationWindow: number; // Default: 5 iterations
  qualityDegradationThreshold: number; // Default: 0.4 (40%)
}

interface IterationData {
  iteration: number;
  error?: string;
  output?: string;
  commits: number;
  extractionSuccess: boolean;
  timestamp?: Date;
}

interface StuckReport {
  isStuck: boolean;
  confidence: number; // 0-1
  summary: string;
  signals: StuckSignal[];
  recommendations: string[];
}

const DEFAULT_CONFIG: StuckDetectorConfig = {
  maxConsecutiveErrors: 3,
  iterationTimeoutMinutes: 10,
  progressCommitThreshold: 3,
  patternRepetitionThreshold: 2,
  qualityDegradationWindow: 5,
  qualityDegradationThreshold: 0.4,
};

/**
 * Calculates Levenshtein distance between two strings.
 * Used for detecting repeated output patterns.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity ratio between two strings (0-1).
 * 1 = identical, 0 = completely different
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

export class StuckDetector {
  private config: StuckDetectorConfig;
  private history: IterationData[] = [];
  private consecutiveErrors = 0;
  private iterationsWithoutCommits = 0;
  private lastIterationTimestamp?: Date;

  constructor(config: Partial<StuckDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyzes current iteration for stuck signals.
   * Returns array of detected signals with severity and confidence.
   */
  analyze(data: IterationData): StuckSignal[] {
    // Add to history
    this.history.push(data);

    // Keep only relevant history (last 10 iterations)
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }

    const signals: StuckSignal[] = [];

    // Signal 1: Consecutive Errors
    if (data.error) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
        signals.push({
          type: "consecutive_errors",
          severity: "high",
          confidence: Math.min(0.8 + this.consecutiveErrors * 0.05, 1),
          evidence: `${this.consecutiveErrors} consecutive errors detected`,
          metadata: { errorCount: this.consecutiveErrors },
        });
      }
    } else {
      this.consecutiveErrors = 0;
    }

    // Signal 2: Repeated Patterns
    if (data.output && this.history.length >= 2) {
      const previousOutputs = this.history
        .slice(-this.config.patternRepetitionThreshold - 1, -1)
        .map((h) => h.output || "");

      let repetitionCount = 0;
      for (const prevOutput of previousOutputs) {
        const sim = similarity(data.output, prevOutput);
        if (sim > 0.8) {
          repetitionCount++;
        }
      }

      if (repetitionCount >= this.config.patternRepetitionThreshold) {
        signals.push({
          type: "repeated_pattern",
          severity: "medium",
          confidence: 0.7,
          evidence: "Agent repeating similar output without progress",
          metadata: { repetitionCount, similarityThreshold: 0.8 },
        });
      }
    }

    // Signal 3: Iteration Timeout
    if (this.lastIterationTimestamp) {
      const now = data.timestamp || new Date();
      const elapsedMinutes =
        (now.getTime() - this.lastIterationTimestamp.getTime()) / 1000 / 60;

      if (elapsedMinutes > this.config.iterationTimeoutMinutes) {
        signals.push({
          type: "iteration_timeout",
          severity: "critical",
          confidence: 1.0,
          evidence: `Iteration exceeded timeout (${elapsedMinutes.toFixed(1)}m > ${this.config.iterationTimeoutMinutes}m)`,
          metadata: {
            elapsedMinutes,
            timeoutMinutes: this.config.iterationTimeoutMinutes,
          },
        });
      }
    }
    this.lastIterationTimestamp = data.timestamp || new Date();

    // Signal 4: Quality Degradation
    if (this.history.length >= this.config.qualityDegradationWindow) {
      const recentHistory = this.history.slice(
        -this.config.qualityDegradationWindow,
      );
      const successRate =
        recentHistory.filter((h) => h.extractionSuccess).length /
        recentHistory.length;

      if (successRate < this.config.qualityDegradationThreshold) {
        signals.push({
          type: "quality_degradation",
          severity: "medium",
          confidence:
            0.6 + (this.config.qualityDegradationThreshold - successRate),
          evidence: `Extraction quality declining (${(successRate * 100).toFixed(0)}% success rate over last ${this.config.qualityDegradationWindow} iterations)`,
          metadata: {
            successRate,
            window: this.config.qualityDegradationWindow,
          },
        });
      }
    }

    // Signal 5: No Progress
    if (data.commits === 0) {
      this.iterationsWithoutCommits++;
    } else {
      this.iterationsWithoutCommits = 0;
    }

    if (this.iterationsWithoutCommits >= this.config.progressCommitThreshold) {
      signals.push({
        type: "no_progress",
        severity: "high",
        confidence: 0.75,
        evidence: `No commits in last ${this.iterationsWithoutCommits} iterations`,
        metadata: { iterationsWithoutCommits: this.iterationsWithoutCommits },
      });
    }

    return signals;
  }

  /**
   * Determines if the agent is stuck based on detected signals.
   * Returns true if high-severity signals detected or multiple medium-severity signals.
   */
  isStuck(signals: StuckSignal[]): boolean {
    if (signals.length === 0) return false;

    // Critical severity → immediate stuck
    const hasCritical = signals.some((s) => s.severity === "critical");
    if (hasCritical) return true;

    // 2+ high severity → stuck
    const highCount = signals.filter((s) => s.severity === "high").length;
    if (highCount >= 2) return true;

    // 3+ medium severity → stuck
    const mediumCount = signals.filter((s) => s.severity === "medium").length;
    if (mediumCount >= 3) return true;

    // Single high severity with high confidence → stuck
    if (highCount === 1) {
      const highSignal = signals.find((s) => s.severity === "high");
      if (highSignal && highSignal.confidence >= 0.8) return true;
    }

    return false;
  }

  /**
   * Generates human-readable stuck report with recommendations.
   */
  generateReport(signals: StuckSignal[]): StuckReport {
    const isStuck = this.isStuck(signals);

    // Calculate overall confidence
    const avgConfidence =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
        : 0;

    // Generate summary
    const summary = isStuck
      ? `Agent is stuck: ${signals.map((s) => s.evidence).join("; ")}`
      : `No stuck state detected (${signals.length} weak signals)`;

    // Generate recommendations
    const recommendations: string[] = [];
    for (const signal of signals) {
      switch (signal.type) {
        case "consecutive_errors":
          recommendations.push(
            "Try simplified prompts focusing on one file at a time",
          );
          break;
        case "repeated_pattern":
          recommendations.push(
            "Reset conversation context to break repetition cycle",
          );
          break;
        case "iteration_timeout":
          recommendations.push(
            "Reduce scope or split task into smaller subtasks",
          );
          break;
        case "quality_degradation":
          recommendations.push(
            "Switch to single-file extraction strategy or use code mapping",
          );
          break;
        case "no_progress":
          recommendations.push("Review task plan for clarity and completeness");
          break;
      }
    }

    // Deduplicate recommendations
    const uniqueRecommendations = Array.from(new Set(recommendations));

    return {
      isStuck,
      confidence: avgConfidence,
      summary,
      signals,
      recommendations: uniqueRecommendations,
    };
  }

  /**
   * Resets internal state (useful for recovery scenarios).
   */
  reset(): void {
    this.consecutiveErrors = 0;
    this.iterationsWithoutCommits = 0;
    this.lastIterationTimestamp = undefined;
    this.history = [];
  }

  /**
   * Gets current signals without modifying state.
   */
  getSignals(): StuckSignal[] {
    if (this.history.length === 0) return [];
    return this.analyze(this.history[this.history.length - 1]);
  }
}

/**
 * Legacy stuck checker for backward compatibility.
 * Uses simple consecutive error counting.
 */
export class LegacyStuckChecker {
  private stuckCount = 0;
  private threshold: number;

  constructor(threshold = 3) {
    this.threshold = threshold;
  }

  analyze(data: { error?: string }): StuckSignal[] {
    if (data.error) {
      this.stuckCount++;
    } else {
      this.stuckCount = 0;
    }

    if (this.stuckCount >= this.threshold) {
      return [
        {
          type: "consecutive_errors",
          severity: "high",
          confidence: 1.0,
          evidence: `${this.stuckCount} consecutive errors (legacy checker)`,
        },
      ];
    }

    return [];
  }

  isStuck(signals: StuckSignal[]): boolean {
    return signals.length > 0;
  }

  generateReport(signals: StuckSignal[]): StuckReport {
    return {
      isStuck: this.isStuck(signals),
      confidence: 1.0,
      summary: signals[0]?.evidence || "No errors detected",
      signals,
      recommendations: ["Manual intervention required"],
    };
  }

  reset(): void {
    this.stuckCount = 0;
  }
}
