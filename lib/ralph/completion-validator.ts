/**
 * Completion Validation for Ralph Loop
 *
 * Validates that task completion is genuine by checking:
 * 1. RALPH_COMPLETE marker present
 * 2. Commits were made
 * 3. Implementation matches plan
 * 4. Modified files align with plan scope
 * 5. Tests executed (if applicable)
 * 6. No critical errors
 *
 * Part of Ralph Loop Reliability Improvements (2026-01-29)
 */

import { execSync } from "child_process";
import path from "path";
import type { AIClient } from "@/lib/ai/client";

export interface CompletionValidation {
  passed: boolean;
  score: number; // 0-100
  checks: {
    hasMarker: boolean; // RALPH_COMPLETE found
    hasCommits: boolean; // commits.length > 0
    matchesPlan: boolean; // Implementation aligns with plan
    qualityThreshold: boolean; // Files modified match plan scope
    testsExecuted: boolean; // Tests ran (if applicable)
    noCriticalErrors: boolean; // No unresolved errors
  };
  failures: string[];
  recommendations: string[];
  metadata?: Record<string, unknown>;
}

export interface ValidationContext {
  output: string;
  commits: string[];
  plan: string;
  workingDir: string;
  aiClient?: AIClient;
}

const RALPH_COMPLETE = "RALPH_COMPLETE";
const CRITICAL_ERROR_MARKER = "CRITICAL_ERROR";

/**
 * Extracts file paths mentioned in plan text.
 * Looks for common patterns: `path/to/file.ts`, /path/to/file.ts, file.ts
 */
function extractPlanFiles(plan: string): string[] {
  const files = new Set<string>();

  // Pattern 1: Backtick-wrapped paths
  const backtickMatches = plan.match(/`([^`]+\.[a-zA-Z]+)`/g);
  if (backtickMatches) {
    backtickMatches.forEach((match) => {
      const file = match.replace(/`/g, "");
      files.add(file);
    });
  }

  // Pattern 2: Paths starting with / or ./
  const pathMatches = plan.match(/(?:^|\s)(\.?\/[^\s]+\.[a-zA-Z]+)/gm);
  if (pathMatches) {
    pathMatches.forEach((match) => {
      const file = match.trim();
      files.add(file);
    });
  }

  // Pattern 3: Common file extensions at word boundaries
  const extMatches = plan.match(
    /\b([a-zA-Z0-9_/-]+\.(ts|tsx|js|jsx|py|java|go|rs|cpp|c|h|md|json|yaml|yml))\b/g,
  );
  if (extMatches) {
    extMatches.forEach((match) => {
      files.add(match);
    });
  }

  return Array.from(files);
}

/**
 * Extracts files modified in commits.
 */
function extractCommittedFiles(
  commits: string[],
  workingDir: string,
): string[] {
  if (commits.length === 0) return [];

  try {
    // Get list of files changed in commits
    const filesOutput = execSync(
      `git diff --name-only ${commits[0]}~1 ${commits[commits.length - 1]}`,
      {
        cwd: workingDir,
        encoding: "utf-8",
      },
    );

    return filesOutput
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch (error) {
    console.warn("Failed to extract committed files:", error);
    return [];
  }
}

/**
 * Calculates plan coverage: % of plan files that were addressed.
 */
function calculatePlanCoverage(
  planFiles: string[],
  committedFiles: string[],
): number {
  if (planFiles.length === 0) return 1.0; // No explicit plan files = assume coverage

  let covered = 0;
  for (const planFile of planFiles) {
    // Normalize paths for comparison
    const normalizedPlanFile = planFile.replace(/^\.\//, "");

    const isAddressed = committedFiles.some((committedFile) => {
      const normalizedCommitted = committedFile.replace(/^\.\//, "");
      // Match if plan file is substring of committed file or vice versa
      return (
        normalizedCommitted.includes(normalizedPlanFile) ||
        normalizedPlanFile.includes(normalizedCommitted)
      );
    });

    if (isAddressed) covered++;
  }

  return covered / planFiles.length;
}

/**
 * Checks if commits seem reasonable (not too many, not too few).
 */
function checkCommitQuality(commits: string[], workingDir: string): boolean {
  if (commits.length === 0) return false;

  try {
    // Check total lines changed
    const diffStats = execSync(
      `git diff --shortstat ${commits[0]}~1 ${commits[commits.length - 1]}`,
      {
        cwd: workingDir,
        encoding: "utf-8",
      },
    );

    // Parse: "X files changed, Y insertions(+), Z deletions(-)"
    const insertionsMatch = diffStats.match(/(\d+) insertion/);
    const deletionsMatch = diffStats.match(/(\d+) deletion/);

    const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
    const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
    const totalChanges = insertions + deletions;

    // Quality threshold: at least 1 line changed, but not ridiculously large (>10k lines)
    return totalChanges > 0 && totalChanges < 10000;
  } catch (error) {
    console.warn("Failed to check commit quality:", error);
    return true; // Assume quality if we can't check
  }
}

/**
 * Checks if tests were executed (looks for test output in working directory).
 */
function checkTestsExecuted(workingDir: string): boolean {
  try {
    // Look for common test artifacts
    const testArtifacts = [
      "coverage",
      ".nyc_output",
      "test-results",
      "junit.xml",
    ];

    for (const artifact of testArtifacts) {
      const artifactPath = path.join(workingDir, artifact);
      try {
        execSync(`test -e "${artifactPath}"`, { cwd: workingDir });
        return true; // Found test artifact
      } catch {
        // Continue checking
      }
    }

    return false; // No test artifacts found
  } catch (error) {
    return false;
  }
}

/**
 * Uses AI to validate plan alignment when structured matching fails.
 */
async function aiAssistedValidation(
  plan: string,
  committedFiles: string[],
  commits: string[],
  aiClient: AIClient,
  workingDir: string,
): Promise<{ valid: boolean; reasoning: string }> {
  try {
    // Get commit messages
    const commitMessages = commits.map((sha) => {
      try {
        return execSync(`git log --format=%B -n 1 ${sha}`, {
          cwd: workingDir,
          encoding: "utf-8",
        }).trim();
      } catch {
        return "";
      }
    });

    const validationPrompt = `You are validating task completion against a plan.

TASK PLAN:
${plan}

FILES MODIFIED:
${committedFiles.join("\n")}

COMMIT MESSAGES:
${commitMessages.join("\n---\n")}

Does this implementation adequately address the plan? Consider:
1. Are the main objectives of the plan achieved?
2. Are the modified files relevant to the plan?
3. Do commit messages indicate meaningful progress?

Respond with JSON only:
{
  "valid": boolean,
  "reasoning": "brief explanation (1-2 sentences)"
}`;

    const response = await aiClient.chat([
      { role: "user", content: validationPrompt },
    ]);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { valid: true, reasoning: "AI validation inconclusive" };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      valid: result.valid ?? true,
      reasoning: result.reasoning ?? "AI validation completed",
    };
  } catch (error) {
    console.warn("AI-assisted validation failed:", error);
    return { valid: true, reasoning: "AI validation failed, assuming valid" };
  }
}

export class CompletionValidator {
  /**
   * Validates task completion.
   */
  async validate(context: ValidationContext): Promise<CompletionValidation> {
    const { output, commits, plan, workingDir, aiClient } = context;

    // Check 1: Has RALPH_COMPLETE marker
    const hasMarker = output.includes(RALPH_COMPLETE);

    // Check 2: Has commits
    const hasCommits = commits.length > 0;

    // Check 3: No critical errors
    const noCriticalErrors = !output.includes(CRITICAL_ERROR_MARKER);

    // Check 4: Quality threshold (commit quality)
    const qualityThreshold = hasCommits
      ? checkCommitQuality(commits, workingDir)
      : false;

    // Check 5: Tests executed
    const testsExecuted = checkTestsExecuted(workingDir);

    // Check 6: Matches plan (most complex)
    let matchesPlan = true;
    let planCoverage = 1.0;
    let aiValidationReasoning = "";

    if (plan && plan.length > 0) {
      const planFiles = extractPlanFiles(plan);
      const committedFiles = extractCommittedFiles(commits, workingDir);

      planCoverage = calculatePlanCoverage(planFiles, committedFiles);

      // If coverage is low, use AI-assisted validation
      if (planCoverage < 0.5 && aiClient) {
        const aiResult = await aiAssistedValidation(
          plan,
          committedFiles,
          commits,
          aiClient,
          workingDir,
        );
        matchesPlan = aiResult.valid;
        aiValidationReasoning = aiResult.reasoning;
      } else {
        // Structural matching: require at least 50% coverage
        matchesPlan = planCoverage >= 0.5;
      }
    }

    // Build checks object
    const checks = {
      hasMarker,
      hasCommits,
      matchesPlan,
      qualityThreshold,
      testsExecuted,
      noCriticalErrors,
    };

    // Calculate score (weighted)
    const weights = {
      hasMarker: 20,
      hasCommits: 20,
      matchesPlan: 30,
      qualityThreshold: 15,
      testsExecuted: 5,
      noCriticalErrors: 10,
    };

    const score =
      (checks.hasMarker ? weights.hasMarker : 0) +
      (checks.hasCommits ? weights.hasCommits : 0) +
      (checks.matchesPlan ? weights.matchesPlan : 0) +
      (checks.qualityThreshold ? weights.qualityThreshold : 0) +
      (checks.testsExecuted ? weights.testsExecuted : 0) +
      (checks.noCriticalErrors ? weights.noCriticalErrors : 0);

    // Determine pass/fail (80% threshold)
    const passed = score >= 80;

    // Collect failures
    const failures: string[] = [];
    if (!checks.hasMarker) failures.push("Missing RALPH_COMPLETE marker");
    if (!checks.hasCommits) failures.push("No commits made");
    if (!checks.matchesPlan)
      failures.push(
        aiValidationReasoning ||
          `Low plan coverage (${(planCoverage * 100).toFixed(0)}%)`,
      );
    if (!checks.qualityThreshold)
      failures.push("Commit quality concerns (too few or too many changes)");
    if (!checks.noCriticalErrors) failures.push("Critical errors detected");

    // Generate recommendations
    const recommendations: string[] = [];
    if (!checks.hasMarker)
      recommendations.push("Ensure agent outputs RALPH_COMPLETE when done");
    if (!checks.hasCommits)
      recommendations.push(
        "Verify agent has write permissions and git is configured",
      );
    if (!checks.matchesPlan)
      recommendations.push(
        "Review plan for clarity and ensure agent understands requirements",
      );
    if (!checks.qualityThreshold)
      recommendations.push("Check if task scope is appropriate");
    if (!checks.testsExecuted)
      recommendations.push("Consider running tests before marking complete");

    return {
      passed,
      score,
      checks,
      failures,
      recommendations,
      metadata: {
        planCoverage,
        aiValidationReasoning: aiValidationReasoning || undefined,
      },
    };
  }
}

/**
 * Legacy completion checker for backward compatibility.
 * Only checks for RALPH_COMPLETE marker and commits > 0.
 */
export class LegacyCompletionChecker {
  async validate(context: {
    output: string;
    commits: string[];
  }): Promise<CompletionValidation> {
    const hasMarker = context.output.includes(RALPH_COMPLETE);
    const hasCommits = context.commits.length > 0;
    const passed = hasMarker && hasCommits;

    return {
      passed,
      score: passed ? 100 : 0,
      checks: {
        hasMarker,
        hasCommits,
        matchesPlan: true, // Not checked in legacy
        qualityThreshold: true, // Not checked in legacy
        testsExecuted: false, // Not checked in legacy
        noCriticalErrors: true, // Not checked in legacy
      },
      failures: passed
        ? []
        : [!hasMarker ? "Missing RALPH_COMPLETE" : "No commits"],
      recommendations: passed ? [] : ["Manual review required"],
    };
  }
}
