/**
 * Test Gate Enforcement for Ralph Loop
 *
 * Prevents PR creation when critical tests fail.
 * Supports 4 policies: strict, warn, skip, autoApprove
 *
 * Part of Ralph Loop Reliability Improvements (2026-01-29)
 */

export type TestGatePolicy = "strict" | "warn" | "skip" | "autoApprove";

export interface TestGateConfig {
  policy: TestGatePolicy;
  criticalTestPatterns: string[]; // e.g., ['auth', 'payment', 'security']
  requireAllPassing: boolean;
  allowedFailureRate: number; // 0-1 (default: 0)
}

export interface TestRunResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures: TestFailure[];
  duration?: number;
}

export interface TestFailure {
  testName: string;
  testPath?: string;
  error?: string;
  stackTrace?: string;
}

export interface TestGateDecision {
  shouldBlock: boolean;
  reason?: string;
  warnings?: string[];
  metadata?: {
    policy: TestGatePolicy;
    failureRate: number;
    criticalFailures: number;
    totalFailures: number;
  };
}

const DEFAULT_CONFIG: TestGateConfig = {
  policy: "warn",
  criticalTestPatterns: [],
  requireAllPassing: false,
  allowedFailureRate: 0,
};

/**
 * Checks if a test is considered critical based on patterns.
 */
export function isCriticalTest(testName: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;

  const lowerTestName = testName.toLowerCase();
  return patterns.some((pattern) =>
    lowerTestName.includes(pattern.toLowerCase()),
  );
}

/**
 * Analyzes test results against policy and decides whether to block PR.
 */
export function analyzeTestResults(
  results: TestRunResult,
  config: TestGateConfig,
): TestGateDecision {
  const {
    policy,
    criticalTestPatterns,
    requireAllPassing,
    allowedFailureRate,
  } = config;

  // Policy: skip → never block
  if (policy === "skip") {
    return {
      shouldBlock: false,
      warnings: ["Test gate policy is 'skip' - tests not enforced"],
      metadata: {
        policy,
        failureRate: 0,
        criticalFailures: 0,
        totalFailures: results.failed,
      },
    };
  }

  // No failures → always pass
  if (results.failed === 0) {
    return {
      shouldBlock: false,
      metadata: {
        policy,
        failureRate: 0,
        criticalFailures: 0,
        totalFailures: 0,
      },
    };
  }

  // Calculate failure rate
  const failureRate = results.total > 0 ? results.failed / results.total : 0;

  // Identify critical failures
  const criticalFailures = results.failures.filter((f) =>
    isCriticalTest(f.testName, criticalTestPatterns),
  );

  // Policy: autoApprove → log but don't block
  if (policy === "autoApprove") {
    const warnings = [
      `${results.failed} test(s) failed but policy is 'autoApprove'`,
    ];
    if (criticalFailures.length > 0) {
      warnings.push(
        `${criticalFailures.length} critical test(s) failed: ${criticalFailures.map((f) => f.testName).join(", ")}`,
      );
    }

    return {
      shouldBlock: false,
      warnings,
      metadata: {
        policy,
        failureRate,
        criticalFailures: criticalFailures.length,
        totalFailures: results.failed,
      },
    };
  }

  // Check critical failures first (applies to all policies except skip/autoApprove)
  // This ensures critical failures get proper "critical" messaging
  if (criticalFailures.length > 0) {
    return {
      shouldBlock: true,
      reason: `${criticalFailures.length} critical test(s) failed: ${criticalFailures.map((f) => f.testName).join(", ")}`,
      metadata: {
        policy,
        failureRate,
        criticalFailures: criticalFailures.length,
        totalFailures: results.failed,
      },
    };
  }

  // Policy: strict → block on any failure
  if (policy === "strict") {
    if (results.failed > 0) {
      return {
        shouldBlock: true,
        reason: `${results.failed} test(s) failed under strict policy`,
        metadata: {
          policy,
          failureRate,
          criticalFailures: criticalFailures.length,
          totalFailures: results.failed,
        },
      };
    }
  }

  // Check requireAllPassing (applies before warn policy check)
  if (requireAllPassing && results.failed > 0) {
    return {
      shouldBlock: true,
      reason: `${results.failed} test(s) failed (requireAllPassing is enabled)`,
      metadata: {
        policy,
        failureRate,
        criticalFailures: 0,
        totalFailures: results.failed,
      },
    };
  }

  // For warn policy: check failure rate threshold only if explicitly set
  // allowedFailureRate=0 (default) means "use policy alone", not "zero tolerance"
  if (policy === "warn") {
    if (
      results.failed > 0 &&
      allowedFailureRate > 0 &&
      failureRate > allowedFailureRate
    ) {
      // Failure rate explicitly set and exceeded
      return {
        shouldBlock: true,
        reason: `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold ${(allowedFailureRate * 100).toFixed(1)}%`,
        metadata: {
          policy,
          failureRate,
          criticalFailures: 0,
          totalFailures: results.failed,
        },
      };
    }

    // Warn policy + failures within limits (or no explicit limit) = don't block
    if (results.failed > 0) {
      return {
        shouldBlock: false,
        warnings: [
          `${results.failed} test(s) failed but policy is 'warn'`,
          "These failures will be noted in PR but not blocked",
        ],
        metadata: {
          policy,
          failureRate,
          criticalFailures: 0,
          totalFailures: results.failed,
        },
      };
    }
  }

  // Check failure rate thresholds (for other policies)
  if (allowedFailureRate > 0 && failureRate > allowedFailureRate) {
    return {
      shouldBlock: true,
      reason: `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold ${(allowedFailureRate * 100).toFixed(1)}%`,
      metadata: {
        policy,
        failureRate,
        criticalFailures: 0,
        totalFailures: results.failed,
      },
    };
  }

  // Default: allow
  return {
    shouldBlock: false,
    metadata: {
      policy,
      failureRate,
      criticalFailures: 0,
      totalFailures: results.failed,
    },
  };
}

export class TestGate {
  private config: TestGateConfig;

  constructor(config: Partial<TestGateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyzes test results and decides whether to block PR creation.
   */
  analyze(
    results: TestRunResult,
    configOverride?: Partial<TestGateConfig>,
  ): TestGateDecision {
    const finalConfig = configOverride
      ? { ...this.config, ...configOverride }
      : this.config;

    return analyzeTestResults(results, finalConfig);
  }

  /**
   * Updates test gate configuration.
   */
  updateConfig(config: Partial<TestGateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): TestGateConfig {
    return { ...this.config };
  }
}

/**
 * Parses test output from common test frameworks.
 * Returns TestRunResult or null if parsing fails.
 */
export function parseTestOutput(output: string): TestRunResult | null {
  // Try Jest format first
  const jestMatch = output.match(
    /Tests:\s+(\d+) failed,\s+(\d+) passed,\s+(\d+) total/i,
  );
  if (jestMatch) {
    const failed = parseInt(jestMatch[1], 10);
    const passed = parseInt(jestMatch[2], 10);
    const total = parseInt(jestMatch[3], 10);

    // Extract failures
    const failures: TestFailure[] = [];
    const failurePattern = /●\s+(.+?)\n/g;
    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      failures.push({ testName: match[1].trim() });
    }

    return {
      passed,
      failed,
      skipped: total - passed - failed,
      total,
      failures,
    };
  }

  // Try Vitest format (supports both "10 total" and "(10)" formats)
  const vitestMatch = output.match(
    /Test Files\s+(\d+) failed.*?(\d+) passed.*?(?:(\d+) total|\((\d+)\))/is,
  );
  if (vitestMatch) {
    const failed = parseInt(vitestMatch[1], 10);
    const passed = parseInt(vitestMatch[2], 10);
    const total = parseInt(vitestMatch[3] || vitestMatch[4], 10);

    const failures: TestFailure[] = [];
    const failurePattern = /❯\s+(.+?)\n/g;
    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      failures.push({ testName: match[1].trim() });
    }

    return {
      passed,
      failed,
      skipped: total - passed - failed,
      total,
      failures,
    };
  }

  // Try Pytest format
  const pytestMatch = output.match(
    /=+\s+(\d+) failed.*?(\d+) passed.*?in\s+([\d.]+)s/is,
  );
  if (pytestMatch) {
    const failed = parseInt(pytestMatch[1], 10);
    const passed = parseInt(pytestMatch[2], 10);
    const duration = parseFloat(pytestMatch[3]);

    const failures: TestFailure[] = [];
    const failurePattern = /FAILED\s+(.+?)\s+-/g;
    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      failures.push({ testName: match[1].trim() });
    }

    return {
      passed,
      failed,
      skipped: 0,
      total: passed + failed,
      failures,
      duration,
    };
  }

  // Generic fallback: look for pass/fail counts
  const genericMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
  if (genericMatch) {
    const passed = parseInt(genericMatch[1], 10);
    const failed = parseInt(genericMatch[2], 10);

    return {
      passed,
      failed,
      skipped: 0,
      total: passed + failed,
      failures: [],
    };
  }

  return null;
}
