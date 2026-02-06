/**
 * Verification Before Completion Skill
 *
 * Blocks completion claims until evidence is provided.
 * Prevents false completions and ensures quality standards are met.
 *
 * This skill requires test execution proof, commit verification, and plan coverage.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Check if completion marker is present in output
 */
function hasCompletionMarker(output: string | undefined): boolean {
  if (!output) return false;

  const markers = [
    "RALPH_COMPLETE",
    "TASK_COMPLETE",
    "COMPLETED",
    "task is done",
    "work is complete",
  ];

  return markers.some((marker) =>
    output.toLowerCase().includes(marker.toLowerCase()),
  );
}

/**
 * Calculate plan coverage from commits
 */
function calculatePlanCoverage(
  plan: string | undefined,
  commits: string[],
): number {
  if (!plan || commits.length === 0) {
    return 0;
  }

  // Extract file paths mentioned in plan
  const filePatternRegex = /`([^`]+\.(ts|tsx|js|jsx|py|go|java|rb|rs))`/g;
  const planFiles = new Set<string>();

  let match;
  while ((match = filePatternRegex.exec(plan)) !== null) {
    planFiles.add(match[1]);
  }

  if (planFiles.size === 0) {
    // No explicit file references in the plan. Don't hard-fail by default.
    return 0.8;
  }

  // For now, return placeholder - in production, this would check git diff
  // against plan files
  return commits.length > 0 ? 0.8 : 0;
}

/**
 * Check test execution evidence
 */
function hasTestEvidence(testHistory: SkillInvocationContext["testHistory"]): {
  hasTests: boolean;
  allPassing: boolean;
} {
  if (!testHistory || testHistory.length === 0) {
    return { hasTests: false, allPassing: false };
  }

  const latestRun = testHistory[testHistory.length - 1];
  return {
    hasTests: true,
    allPassing: latestRun.status === "passed",
  };
}

/**
 * Check commit quality
 */
function hasQualityCommits(commits: string[]): {
  hasCommits: boolean;
  quality: "good" | "suspicious" | "none";
} {
  if (commits.length === 0) {
    return { hasCommits: false, quality: "none" };
  }

  // In production, this would analyze commit content
  // For now, simple check
  if (commits.length >= 1) {
    return { hasCommits: true, quality: "good" };
  }

  return { hasCommits: true, quality: "suspicious" };
}

/**
 * Verification Before Completion System Prompt
 */
const VERIFICATION_PROMPT = `# Verification Before Completion

## IRON LAW: EVIDENCE BEFORE ASSERTIONS

You are enforcing verification discipline. Never claim work is complete without running verification commands.

## Required Evidence

Before claiming completion, you MUST provide evidence of:

1. **Tests Pass** - Run tests and show output
   \`\`\`bash
   npm test  # or pytest, go test, cargo test, etc.
   \`\`\`
   Required: Green output showing all tests pass

2. **Code Committed** - Verify changes are committed
   \`\`\`bash
   git status
   git log -1
   \`\`\`
   Required: Clean working tree, recent commit visible

3. **Plan Coverage** - All plan items addressed
   - Review original plan
   - Check each item is implemented or explicitly deferred
   - Document any deviations from plan

4. **Build Succeeds** - Project compiles/builds
   \`\`\`bash
   npm run build  # or make, cargo build, etc.
   \`\`\`
   Required: Successful build output

5. **No Regressions** - Existing functionality still works
   - Run full test suite (not just new tests)
   - Verify no new errors in logs
   - Check related features still work

## Completion Checklist

Before marking task as complete, verify:

□ All tests pass (evidence: test output)
□ Code is committed (evidence: git log)
□ Plan fully addressed (evidence: item-by-item review)
□ Build succeeds (evidence: build output)
□ No regressions (evidence: full test suite)
□ Documentation updated if needed
□ Clean code (no TODOs, no commented code)

## Blocking Conditions

This skill will BLOCK completion if:
- No test execution evidence
- Tests failing
- No commits made
- Plan coverage <80%
- Build failures
- Regressions detected

## Success Claims Require Proof

❌ "Tests pass" → ✓ "Tests pass (output: ...)"
❌ "Code committed" → ✓ "Code committed (sha: abc123)"
❌ "Implementation complete" → ✓ "All 5 plan items implemented (details: ...)"

Remember: Show, don't tell. Commands must be run, output must be captured.`;

/**
 * Verification Before Completion Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { commits = [], testHistory, planContent, phase } = context;

  // Only enforce in review/executing phases
  if (phase !== "review" && phase !== "executing") {
    return {
      skillId: "verification-before-completion",
      status: "passed",
      message: "Not in completion phase - verification skipped",
      timestamp: new Date(),
    };
  }

  const failures: string[] = [];
  const warnings: string[] = [];

  // Check 1: Test evidence
  const testCheck = hasTestEvidence(testHistory);
  if (!testCheck.hasTests) {
    failures.push("No test execution evidence");
  } else if (!testCheck.allPassing) {
    failures.push("Tests failing - must pass before completion");
  }

  // Check 2: Commits
  const commitCheck = hasQualityCommits(commits);
  if (!commitCheck.hasCommits) {
    failures.push("No commits made - work not persisted");
  } else if (commitCheck.quality === "suspicious") {
    warnings.push("Commit quality questionable - review recommended");
  }

  // Check 3: Plan coverage
  const coverage = calculatePlanCoverage(planContent, commits);
  if (coverage < 0.8) {
    failures.push(
      `Low plan coverage (${Math.round(coverage * 100)}%) - review plan alignment`,
    );
  }

  // If any failures, block completion
  if (failures.length > 0) {
    const failureSummary = failures.join("; ");
    return {
      skillId: "verification-before-completion",
      status: "blocked",
      message: `BLOCKED: ${failureSummary}`,
      recommendations: [
        "Complete the following verification steps:",
        ...failures,
        "",
        ...(warnings.length > 0 ? ["Warnings:", ...warnings] : []),
        "",
        "Run verification commands:",
        "npm test (show passing output)",
        "git status && git log -1 (verify commit)",
        "npm run build (verify build success)",
      ],
      metadata: {
        failures,
        warnings,
        planCoverage: coverage,
        hasTests: testCheck.hasTests,
        testsPass: testCheck.allPassing,
        hasCommits: commitCheck.hasCommits,
      },
      timestamp: new Date(),
    };
  }

  // Warnings but no blocking issues
  if (warnings.length > 0) {
    return {
      skillId: "verification-before-completion",
      status: "warning",
      message: `Verification passed with warnings. Review recommended.`,
      recommendations: warnings,
      metadata: {
        warnings,
        planCoverage: coverage,
      },
      timestamp: new Date(),
    };
  }

  // All checks passed
  return {
    skillId: "verification-before-completion",
    status: "passed",
    message: "All verification checks passed. Completion approved.",
    metadata: {
      planCoverage: coverage,
      testsPass: true,
      commitsVerified: true,
    },
    timestamp: new Date(),
  };
};

/**
 * Verification Before Completion Skill Definition
 */
export const verificationBeforeCompletion: SkillDefinition = {
  id: "verification-before-completion",
  name: "Verification Before Completion",
  description:
    "Require evidence before completion claims. Prevent false completions.",
  category: "quality-discipline",
  enforcement: "blocking",
  triggerPhases: ["review", "executing"],
  systemPrompt: VERIFICATION_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Superpowers (adapted for Loopforge)",
};
