/**
 * Test-Driven Development (TDD) Skill
 *
 * Enforces the TDD workflow: write failing test, verify RED state,
 * implement code, verify GREEN state, refactor.
 *
 * This skill blocks commits that don't follow the Red-Green-Refactor cycle.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";
import { existsSync } from "fs";
import { join } from "path";
import { Glob } from "glob";

/**
 * Detect if files contain production code changes
 */
async function hasProductionCodeChanges(
  modifiedFiles: string[],
): Promise<boolean> {
  const testPatterns = [
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /__tests__\//,
    /test\//,
    /tests\//,
  ];

  return modifiedFiles.some(
    (file) => !testPatterns.some((pattern) => pattern.test(file)),
  );
}

/**
 * Find test files corresponding to modified production files
 */
async function findCorrespondingTests(
  modifiedFiles: string[],
  workingDir: string,
): Promise<string[]> {
  const testFiles: string[] = [];

  for (const file of modifiedFiles) {
    // Skip if already a test file
    if (
      file.includes(".test.") ||
      file.includes(".spec.") ||
      file.includes("__tests__")
    ) {
      continue;
    }

    // Common test patterns
    const patterns = [
      file.replace(/\.(ts|tsx|js|jsx)$/, ".test.$1"),
      file.replace(/\.(ts|tsx|js|jsx)$/, ".spec.$1"),
      file.replace(/^(.*)\/([^/]+)$/, "$1/__tests__/$2"),
      file.replace(/^(.*)\/([^/]+)$/, "__tests__/$1/$2"),
    ];

    for (const pattern of patterns) {
      const fullPath = join(workingDir, pattern);
      if (existsSync(fullPath)) {
        testFiles.push(pattern);
      }
    }
  }

  return testFiles;
}

/**
 * Check test execution history for RED state
 */
function hadFailingTests(
  testHistory: SkillInvocationContext["testHistory"],
): boolean {
  if (!testHistory || testHistory.length === 0) {
    return false;
  }

  // Look for any failed test runs
  return testHistory.some((run) => run.status === "failed");
}

/**
 * Check test execution history for GREEN state
 */
function hasPassingTests(
  testHistory: SkillInvocationContext["testHistory"],
): boolean {
  if (!testHistory || testHistory.length === 0) {
    return false;
  }

  // Most recent run should be passing
  const latestRun = testHistory[testHistory.length - 1];
  return latestRun.status === "passed";
}

/**
 * TDD Skill System Prompt
 */
const TDD_SYSTEM_PROMPT = `# Test-Driven Development (TDD)

## IRON LAW: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

You are enforcing Test-Driven Development discipline. Every line of production code must be justified by a failing test.

## The Red-Green-Refactor Cycle

1. **RED** - Write a failing test
   - Test must compile but fail on assertion
   - Verify test failure with output showing expected vs. actual
   - This proves the test can fail (avoiding false positives)

2. **GREEN** - Write minimal code to pass
   - Implement just enough to make the test pass
   - No gold plating, no future-proofing
   - Run test and verify it passes

3. **REFACTOR** - Improve without changing behavior
   - Extract duplicated code
   - Improve names and structure
   - Tests must still pass after refactoring

## Blocking Conditions

This skill will BLOCK commits if:
- Production code modified without corresponding tests
- Tests passing immediately (no RED state observed)
- Tests not executed before commit
- Test coverage missing for new functionality

## Allowed Without Tests

- Documentation changes (*.md, comments)
- Configuration files (package.json, tsconfig.json)
- Type definitions without logic
- Test files themselves

## Success Criteria

✓ Test file exists for modified production code
✓ Test was observed failing (RED state)
✓ Test now passes (GREEN state)
✓ Code implements minimal solution

Remember: "Test first" is not negotiable. The test must exist and must fail before any implementation.`;

/**
 * TDD Skill Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { modifiedFiles = [], testHistory, workingDir } = context;

  // No files modified = nothing to validate
  if (modifiedFiles.length === 0) {
    return {
      skillId: "test-driven-development",
      status: "passed",
      message: "No files modified - TDD validation skipped",
      timestamp: new Date(),
    };
  }

  // Check if production code was modified
  const hasProductionChanges = await hasProductionCodeChanges(modifiedFiles);

  if (!hasProductionChanges) {
    return {
      skillId: "test-driven-development",
      status: "passed",
      message: "Only test files modified - TDD cycle not required",
      timestamp: new Date(),
    };
  }

  // Find corresponding test files
  const testFiles = await findCorrespondingTests(modifiedFiles, workingDir);

  if (testFiles.length === 0) {
    const productionFiles = modifiedFiles.filter((f) => !f.includes("test"));

    return {
      skillId: "test-driven-development",
      status: "blocked",
      message:
        "BLOCKED: Production code modified without corresponding tests. Write failing test first.",
      recommendations: [
        `Create test files for: ${productionFiles.join(", ")}`,
        "Follow naming convention: filename.test.ts or __tests__/filename.ts",
        "Ensure test fails first (RED state) before implementing",
      ],
      metadata: {
        missingTests: productionFiles,
      },
      timestamp: new Date(),
    };
  }

  // Check test execution history
  if (!testHistory || testHistory.length === 0) {
    return {
      skillId: "test-driven-development",
      status: "blocked",
      message: "BLOCKED: Tests not executed. Run tests to verify RED state.",
      recommendations: [
        "Run: npm test (or appropriate test command)",
        "Verify test fails before implementation",
        "Document expected vs. actual output",
      ],
      metadata: {
        testFiles,
      },
      timestamp: new Date(),
    };
  }

  // Check for RED state
  const hadRed = hadFailingTests(testHistory);

  if (!hadRed) {
    return {
      skillId: "test-driven-development",
      status: "blocked",
      message:
        "BLOCKED: Tests passing immediately. Must observe RED state first to validate test correctness.",
      recommendations: [
        "Verify test can actually fail",
        "Check test assertions are meaningful",
        "Avoid tests that always pass (false positives)",
      ],
      metadata: {
        testFiles,
        testHistory: testHistory.map((t) => t.status),
      },
      timestamp: new Date(),
    };
  }

  // Check for GREEN state
  const hasGreen = hasPassingTests(testHistory);

  if (!hasGreen) {
    return {
      skillId: "test-driven-development",
      status: "warning",
      message:
        "WARNING: Tests still failing. Complete implementation before committing.",
      recommendations: [
        "Implement minimal code to make tests pass",
        "Run tests again to verify GREEN state",
        "Commit only when all tests pass",
      ],
      metadata: {
        testFiles,
      },
      timestamp: new Date(),
    };
  }

  // Success! TDD cycle followed correctly
  return {
    skillId: "test-driven-development",
    status: "passed",
    message: "TDD cycle followed correctly: RED → GREEN verified",
    metadata: {
      testFiles,
      cycleComplete: true,
    },
    timestamp: new Date(),
  };
};

/**
 * Test-Driven Development Skill Definition
 */
export const testDrivenDevelopment: SkillDefinition = {
  id: "test-driven-development",
  name: "Test-Driven Development",
  description:
    "Enforce TDD workflow: write failing test, verify RED, implement, verify GREEN, refactor",
  category: "quality-discipline",
  enforcement: "blocking",
  triggerPhases: ["executing"],
  systemPrompt: TDD_SYSTEM_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Superpowers (adapted for Loopforge)",
};
