import { describe, it, expect } from "vitest";
import {
  parseTestSummary,
  formatTestDuration,
  truncateTestOutput,
} from "@/lib/ralph/test-runner";

describe("Test Runner Utilities", () => {
  describe("parseTestSummary", () => {
    it("should parse Jest/Vitest output", () => {
      const output = `
 ✓ __tests__/utils.test.ts (6 tests)
 ✓ __tests__/crypto.test.ts (5 tests)

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  10:30:00
   Duration  500ms
`;

      const summary = parseTestSummary(output);

      expect(summary).not.toBeNull();
      expect(summary?.passed).toBe(11);
      expect(summary?.total).toBe(11);
    });

    it("should parse pytest output", () => {
      const output = `
============================= test session starts ==============================
collected 15 items

tests/test_api.py ....                                                     [100%]

============================== 15 passed in 0.45s ==============================
`;

      const summary = parseTestSummary(output);

      expect(summary).not.toBeNull();
      expect(summary?.passed).toBe(15);
      expect(summary?.total).toBe(15);
    });

    it("should parse Go test output", () => {
      const output = `
=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestSubtract
--- PASS: TestSubtract (0.00s)
PASS
ok      github.com/user/project    0.005s
`;

      const summary = parseTestSummary(output);

      expect(summary).not.toBeNull();
      expect(summary?.passed).toBe(1);
      expect(summary?.failed).toBe(0);
    });

    it("should handle failed tests", () => {
      const output = `
Tests: 1 passed, 1 failed, 2 total
`;

      const summary = parseTestSummary(output);

      expect(summary).not.toBeNull();
      expect(summary?.failed).toBe(1);
      expect(summary?.passed).toBe(1);
      expect(summary?.total).toBe(2);
    });

    it("should return null if no summary found", () => {
      const output = "Some random output without test summary";

      const summary = parseTestSummary(output);

      expect(summary).toBeNull();
    });
  });

  describe("formatTestDuration", () => {
    it("should format milliseconds", () => {
      expect(formatTestDuration(500)).toBe("500ms");
      expect(formatTestDuration(999)).toBe("999ms");
    });

    it("should format seconds", () => {
      expect(formatTestDuration(1000)).toBe("1.0s");
      expect(formatTestDuration(5500)).toBe("5.5s");
      expect(formatTestDuration(59999)).toBe("60.0s");
    });

    it("should format minutes and seconds", () => {
      expect(formatTestDuration(60000)).toBe("1m 0s");
      expect(formatTestDuration(90000)).toBe("1m 30s");
      expect(formatTestDuration(125000)).toBe("2m 5s");
    });
  });

  describe("truncateTestOutput", () => {
    it("should not truncate short output", () => {
      const output = "Short test output";
      expect(truncateTestOutput(output, 100)).toBe(output);
    });

    it("should truncate long output", () => {
      const output = "a".repeat(200);
      const result = truncateTestOutput(output, 100);

      expect(result.length).toBeLessThan(output.length);
      expect(result).toContain("[Output truncated");
    });

    it("should preserve head and tail", () => {
      const output = "HEAD" + "x".repeat(200) + "TAIL";
      const result = truncateTestOutput(output, 100);

      expect(result).toContain("HEAD");
      expect(result).toContain("TAIL");
    });
  });
});
