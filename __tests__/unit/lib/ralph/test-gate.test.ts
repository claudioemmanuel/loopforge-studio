/**
 * Unit tests for TestGate
 * Target coverage: 95%+
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TestGate,
  isCriticalTest,
  analyzeTestResults,
  parseTestOutput,
  type TestRunResult,
  type TestGatePolicy,
} from "@/lib/ralph/test-gate";

describe("TestGate", () => {
  describe("isCriticalTest()", () => {
    it("should detect critical tests by pattern", () => {
      const patterns = ["auth", "payment", "security"];

      expect(isCriticalTest("Auth login test", patterns)).toBe(true);
      expect(isCriticalTest("Payment processing", patterns)).toBe(true);
      expect(isCriticalTest("Security validation", patterns)).toBe(true);
    });

    it("should be case insensitive", () => {
      const patterns = ["AUTH", "PAYMENT"];

      expect(isCriticalTest("auth login test", patterns)).toBe(true);
      expect(isCriticalTest("PAYMENT processing", patterns)).toBe(true);
    });

    it("should return false for non-matching tests", () => {
      const patterns = ["auth", "payment"];

      expect(isCriticalTest("UI rendering test", patterns)).toBe(false);
      expect(isCriticalTest("Utils helper test", patterns)).toBe(false);
    });

    it("should return false for empty patterns", () => {
      expect(isCriticalTest("Any test", [])).toBe(false);
    });
  });

  describe("analyzeTestResults() - Policy: skip", () => {
    it("should never block with skip policy", () => {
      const result: TestRunResult = {
        passed: 0,
        failed: 10,
        skipped: 0,
        total: 10,
        failures: Array(10).fill({ testName: "Failed test" }),
      };

      const decision = analyzeTestResults(result, {
        policy: "skip",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(false);
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings![0]).toContain("skip");
    });
  });

  describe("analyzeTestResults() - Policy: strict", () => {
    it("should block on any failure", () => {
      const result: TestRunResult = {
        passed: 9,
        failed: 1,
        skipped: 0,
        total: 10,
        failures: [{ testName: "Minor UI test" }],
      };

      const decision = analyzeTestResults(result, {
        policy: "strict",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(true);
      expect(decision.reason).toContain("1 test(s) failed under strict policy");
    });

    it("should not block when all pass", () => {
      const result: TestRunResult = {
        passed: 10,
        failed: 0,
        skipped: 0,
        total: 10,
        failures: [],
      };

      const decision = analyzeTestResults(result, {
        policy: "strict",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(false);
    });
  });

  describe("analyzeTestResults() - Policy: warn", () => {
    it("should not block but warn on failures", () => {
      const result: TestRunResult = {
        passed: 8,
        failed: 2,
        skipped: 0,
        total: 10,
        failures: [{ testName: "Test 1" }, { testName: "Test 2" }],
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(false);
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings![0]).toContain("2 test(s) failed");
    });

    it("should block on critical test failures even with warn", () => {
      const result: TestRunResult = {
        passed: 9,
        failed: 1,
        skipped: 0,
        total: 10,
        failures: [{ testName: "Auth login test" }],
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: ["auth"],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(true);
      expect(decision.reason).toContain("critical test(s) failed");
      expect(decision.reason).toContain("Auth login test");
    });
  });

  describe("analyzeTestResults() - Policy: autoApprove", () => {
    it("should not block but warn on failures", () => {
      const result: TestRunResult = {
        passed: 5,
        failed: 5,
        skipped: 0,
        total: 10,
        failures: Array(5).fill({ testName: "Failed test" }),
      };

      const decision = analyzeTestResults(result, {
        policy: "autoApprove",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(false);
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings![0]).toContain("autoApprove");
    });

    it("should warn about critical failures but not block", () => {
      const result: TestRunResult = {
        passed: 9,
        failed: 1,
        skipped: 0,
        total: 10,
        failures: [{ testName: "Payment processing test" }],
      };

      const decision = analyzeTestResults(result, {
        policy: "autoApprove",
        criticalTestPatterns: ["payment"],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(false);
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings!.some((w) => w.includes("critical"))).toBe(true);
    });
  });

  describe("analyzeTestResults() - Critical Test Detection", () => {
    it("should block on critical test failure across policies", () => {
      const policies: TestGatePolicy[] = ["warn", "strict"];

      policies.forEach((policy) => {
        const result: TestRunResult = {
          passed: 9,
          failed: 1,
          skipped: 0,
          total: 10,
          failures: [{ testName: "Security validation test" }],
        };

        const decision = analyzeTestResults(result, {
          policy,
          criticalTestPatterns: ["security"],
          requireAllPassing: false,
          allowedFailureRate: 0,
        });

        expect(decision.shouldBlock).toBe(true);
        expect(decision.metadata?.criticalFailures).toBe(1);
      });
    });

    it("should identify multiple critical failures", () => {
      const result: TestRunResult = {
        passed: 7,
        failed: 3,
        skipped: 0,
        total: 10,
        failures: [
          { testName: "Auth test 1" },
          { testName: "Payment test" },
          { testName: "Normal test" },
        ],
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: ["auth", "payment"],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(true);
      expect(decision.metadata?.criticalFailures).toBe(2);
      expect(decision.reason).toContain("2 critical test(s) failed");
    });
  });

  describe("analyzeTestResults() - Failure Rate", () => {
    it("should block when failure rate exceeds threshold", () => {
      const result: TestRunResult = {
        passed: 5,
        failed: 5,
        skipped: 0,
        total: 10,
        failures: Array(5).fill({ testName: "Test" }),
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0.3, // 30% allowed, 50% actual
      });

      expect(decision.shouldBlock).toBe(true);
      expect(decision.reason).toContain("Failure rate");
      expect(decision.metadata?.failureRate).toBe(0.5);
    });

    it("should not block when within allowed rate", () => {
      const result: TestRunResult = {
        passed: 9,
        failed: 1,
        skipped: 0,
        total: 10,
        failures: [{ testName: "Test" }],
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: [],
        requireAllPassing: false,
        allowedFailureRate: 0.15, // 15% allowed, 10% actual
      });

      expect(decision.shouldBlock).toBe(false);
    });
  });

  describe("analyzeTestResults() - Require All Passing", () => {
    it("should block on any failure when required", () => {
      const result: TestRunResult = {
        passed: 99,
        failed: 1,
        skipped: 0,
        total: 100,
        failures: [{ testName: "One test" }],
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: [],
        requireAllPassing: true,
        allowedFailureRate: 0,
      });

      expect(decision.shouldBlock).toBe(true);
      expect(decision.reason).toContain("requireAllPassing");
    });
  });

  describe("analyzeTestResults() - Metadata", () => {
    it("should include comprehensive metadata", () => {
      const result: TestRunResult = {
        passed: 7,
        failed: 3,
        skipped: 0,
        total: 10,
        failures: [
          { testName: "Auth test" },
          { testName: "Normal test 1" },
          { testName: "Normal test 2" },
        ],
      };

      const decision = analyzeTestResults(result, {
        policy: "warn",
        criticalTestPatterns: ["auth"],
        requireAllPassing: false,
        allowedFailureRate: 0,
      });

      expect(decision.metadata).toBeDefined();
      expect(decision.metadata!.policy).toBe("warn");
      expect(decision.metadata!.failureRate).toBe(0.3);
      expect(decision.metadata!.criticalFailures).toBe(1);
      expect(decision.metadata!.totalFailures).toBe(3);
    });
  });
});

describe("TestGate Class", () => {
  let testGate: TestGate;

  beforeEach(() => {
    testGate = new TestGate({
      policy: "warn",
      criticalTestPatterns: ["auth"],
      requireAllPassing: false,
      allowedFailureRate: 0,
    });
  });

  it("should analyze with instance config", () => {
    const result: TestRunResult = {
      passed: 9,
      failed: 1,
      skipped: 0,
      total: 10,
      failures: [{ testName: "Auth test" }],
    };

    const decision = testGate.analyze(result);

    expect(decision.shouldBlock).toBe(true);
  });

  it("should allow config override", () => {
    const result: TestRunResult = {
      passed: 9,
      failed: 1,
      skipped: 0,
      total: 10,
      failures: [{ testName: "Normal test" }],
    };

    const decision = testGate.analyze(result, { policy: "strict" });

    expect(decision.shouldBlock).toBe(true);
    expect(decision.reason).toContain("strict");
  });

  it("should update config", () => {
    testGate.updateConfig({ policy: "strict" });

    const config = testGate.getConfig();

    expect(config.policy).toBe("strict");
  });

  it("should get current config", () => {
    const config = testGate.getConfig();

    expect(config.policy).toBe("warn");
    expect(config.criticalTestPatterns).toEqual(["auth"]);
  });
});

describe("parseTestOutput()", () => {
  describe("Jest format", () => {
    it("should parse Jest output", () => {
      const output = `
Tests: 2 failed, 8 passed, 10 total
Snapshots: 0 total
Time: 5.123s

● Test Suite › Test Name
  Expected true to be false

● Another Test
  Error message
`;

      const result = parseTestOutput(output);

      expect(result).toBeDefined();
      expect(result!.passed).toBe(8);
      expect(result!.failed).toBe(2);
      expect(result!.total).toBe(10);
      expect(result!.failures.length).toBeGreaterThan(0);
    });
  });

  describe("Vitest format", () => {
    it("should parse Vitest output", () => {
      const output = `
Test Files  1 failed | 9 passed (10)
     Tests  2 failed | 8 passed (10)
  Start at  12:00:00
  Duration  5.12s

❯ test/example.test.ts › failing test
  AssertionError: expected 1 to equal 2
`;

      const result = parseTestOutput(output);

      expect(result).toBeDefined();
      expect(result!.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Pytest format", () => {
    it("should parse Pytest output", () => {
      const output = `
============================= test session starts ==============================
collected 10 items

tests/test_example.py ..........                                         [100%]

FAILED tests/test_auth.py::test_login - AssertionError
FAILED tests/test_payment.py::test_charge - ValueError

============================== 2 failed, 8 passed in 5.12s =====================
`;

      const result = parseTestOutput(output);

      expect(result).toBeDefined();
      expect(result!.passed).toBe(8);
      expect(result!.failed).toBe(2);
      expect(result!.duration).toBe(5.12);
      expect(result!.failures.length).toBeGreaterThan(0);
    });
  });

  describe("Generic format", () => {
    it("should parse generic pass/fail format", () => {
      const output = "8 passed, 2 failed";

      const result = parseTestOutput(output);

      expect(result).toBeDefined();
      expect(result!.passed).toBe(8);
      expect(result!.failed).toBe(2);
      expect(result!.total).toBe(10);
    });
  });

  describe("Unparseable output", () => {
    it("should return null for unparseable output", () => {
      const output = "Random text with no test results";

      const result = parseTestOutput(output);

      expect(result).toBeNull();
    });
  });
});
