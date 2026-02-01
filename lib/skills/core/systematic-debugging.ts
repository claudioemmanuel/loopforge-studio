/**
 * Systematic Debugging Skill
 *
 * Enforces root cause investigation before proposing fixes.
 * Triggers when stuck signals are detected or errors occur.
 *
 * Prevents "guess and check" debugging by requiring evidence-based analysis.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Analyze stuck signals for debugging insights
 */
function analyzeStuckSignals(signals: SkillInvocationContext["stuckSignals"]): {
  rootCauses: string[];
  evidenceNeeded: string[];
} {
  if (!signals || signals.length === 0) {
    return { rootCauses: [], evidenceNeeded: [] };
  }

  const rootCauses: string[] = [];
  const evidenceNeeded: string[] = [];

  for (const signal of signals) {
    switch (signal.type) {
      case "consecutive_errors":
        rootCauses.push(
          `Repeated failures suggest systematic issue: ${signal.evidence}`,
        );
        evidenceNeeded.push("Stack trace analysis", "Error message patterns");
        break;

      case "repeated_patterns":
        rootCauses.push(
          `AI producing identical output indicates stuck reasoning: ${signal.evidence}`,
        );
        evidenceNeeded.push(
          "Prompt analysis",
          "Context window inspection",
          "Model temperature check",
        );
        break;

      case "quality_degradation":
        rootCauses.push(
          `Declining success rate indicates approach failure: ${signal.evidence}`,
        );
        evidenceNeeded.push(
          "Recent changes review",
          "Dependency check",
          "Resource availability",
        );
        break;

      case "no_progress":
        rootCauses.push(
          `No commits suggest blocking issue: ${signal.evidence}`,
        );
        evidenceNeeded.push(
          "Permission check",
          "Git status",
          "File system access",
        );
        break;

      case "iteration_timeout":
        rootCauses.push(
          `Timeout suggests infinite loop or resource exhaustion: ${signal.evidence}`,
        );
        evidenceNeeded.push(
          "CPU/memory profiling",
          "Loop detection",
          "External API latency",
        );
        break;
    }
  }

  return { rootCauses, evidenceNeeded };
}

/**
 * Check if debugging investigation has been performed
 */
function hasInvestigationEvidence(context: SkillInvocationContext): {
  hasEvidence: boolean;
  missingSteps: string[];
} {
  const missingSteps: string[] = [];

  // Check for error analysis
  if (!context.metadata?.errorAnalysis) {
    missingSteps.push("Error analysis (stack trace, error type, frequency)");
  }

  // Check for hypothesis formation
  if (!context.metadata?.hypothesis) {
    missingSteps.push("Hypothesis about root cause (what, why, how to verify)");
  }

  // Check for verification attempt
  if (!context.metadata?.verification) {
    missingSteps.push(
      "Verification of hypothesis (test, log output, reproduction)",
    );
  }

  return {
    hasEvidence: missingSteps.length === 0,
    missingSteps,
  };
}

/**
 * Systematic Debugging System Prompt
 */
const SYSTEMATIC_DEBUGGING_PROMPT = `# Systematic Debugging

## IRON LAW: UNDERSTAND BEFORE YOU FIX

You are enforcing systematic debugging discipline. Never propose fixes without understanding root causes.

## The Scientific Method for Debugging

1. **OBSERVE** - Gather facts about the failure
   - What is the error message? (exact text)
   - When does it occur? (always, intermittently, specific conditions)
   - What changed recently? (code, dependencies, environment)
   - What works correctly? (similar code, previous versions)

2. **HYPOTHESIZE** - Form testable theories
   - What could cause this specific symptom?
   - Which hypothesis is most likely based on evidence?
   - How can we test each hypothesis?

3. **EXPERIMENT** - Test hypotheses systematically
   - Minimal reproduction case
   - Add logging/debugging output
   - Binary search (comment out code until it works)
   - Compare working vs. broken states

4. **ANALYZE** - Understand why the fix works
   - Why did this cause the problem?
   - Why does the fix resolve it?
   - What prevents similar issues in the future?

5. **VERIFY** - Confirm the fix
   - Does error still occur?
   - Did we introduce new issues?
   - Do all tests pass?

## Anti-Patterns to Avoid

❌ "Let's try changing X and see what happens"
❌ "This worked before, maybe if we..."
❌ "Stack Overflow says to do Y"
❌ "The error mentions Z, let's modify Z"

✓ "The error occurs because X, proven by Y, fixed by Z"
✓ "I reproduced the issue in isolation and verified the cause"
✓ "The root cause is X, not just the symptom Y"

## Blocking Conditions

This skill will BLOCK fixes if:
- No error analysis performed (stack trace, error type)
- No hypothesis about root cause
- No verification of hypothesis
- Fix proposed without understanding why it works

## Required Evidence

Before proposing a fix, you must provide:
1. Exact error message and stack trace
2. Reproduction steps (minimal case)
3. Hypothesis about root cause
4. Experiment results verifying hypothesis
5. Explanation of why fix addresses root cause

Remember: Guessing wastes time. Understanding saves time.`;

/**
 * Systematic Debugging Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { stuckSignals, phase } = context;

  // Only trigger if in stuck state or executing with signals
  if (phase !== "stuck" && !stuckSignals?.length) {
    return {
      skillId: "systematic-debugging",
      status: "passed",
      message: "No debugging needed - system operating normally",
      timestamp: new Date(),
    };
  }

  // Analyze stuck signals
  const analysis = analyzeStuckSignals(stuckSignals);

  if (analysis.rootCauses.length === 0) {
    return {
      skillId: "systematic-debugging",
      status: "warning",
      message:
        "System stuck but no clear signals. Begin systematic investigation.",
      recommendations: [
        "Review recent changes",
        "Check error logs",
        "Verify dependencies and environment",
      ],
      timestamp: new Date(),
    };
  }

  // Check if investigation has been performed
  const investigation = hasInvestigationEvidence(context);

  if (!investigation.hasEvidence) {
    return {
      skillId: "systematic-debugging",
      status: "blocked",
      message:
        "BLOCKED: Fix proposed without root cause investigation. Follow systematic debugging process.",
      recommendations: [
        "Complete missing investigation steps:",
        ...investigation.missingSteps,
        "",
        "Identified root causes to investigate:",
        ...analysis.rootCauses,
        "",
        "Evidence needed:",
        ...analysis.evidenceNeeded,
      ],
      metadata: {
        rootCauses: analysis.rootCauses,
        evidenceNeeded: analysis.evidenceNeeded,
        missingSteps: investigation.missingSteps,
      },
      timestamp: new Date(),
    };
  }

  // Investigation complete - allow fix
  return {
    skillId: "systematic-debugging",
    status: "passed",
    message:
      "Systematic investigation complete. Root cause understood, fix may proceed.",
    metadata: {
      rootCauses: analysis.rootCauses,
      investigationComplete: true,
    },
    timestamp: new Date(),
  };
};

/**
 * Systematic Debugging Skill Definition
 */
export const systematicDebugging: SkillDefinition = {
  id: "systematic-debugging",
  name: "Systematic Debugging",
  description:
    "Enforce root cause investigation before fixes. Prevent guess-and-check debugging.",
  category: "debugging",
  enforcement: "blocking",
  triggerPhases: ["stuck", "executing"],
  systemPrompt: SYSTEMATIC_DEBUGGING_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Superpowers (adapted for Loopforge)",
};
