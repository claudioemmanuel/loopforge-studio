/**
 * Autonomous Code Generation Skill
 *
 * Guides Ralph loop through autonomous code generation with:
 * - Smart file extraction with confidence scoring
 * - Progressive strategy escalation
 * - Automatic recovery orchestration
 * - Plan-based implementation validation
 *
 * This skill integrates with Loopforge's reliability features.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Check extraction success patterns
 */
function analyzeExtractionQuality(context: SkillInvocationContext): {
  extractionSuccessRate: number;
  recommendedStrategy: string | null;
  issues: string[];
} {
  const { metadata = {} } = context;
  const issues: string[] = [];

  // Check extraction metadata
  const extractionAttempts = (metadata.extractionAttempts as number) || 0;
  const extractionSuccesses = (metadata.extractionSuccesses as number) || 0;

  const extractionSuccessRate =
    extractionAttempts > 0 ? extractionSuccesses / extractionAttempts : 1;

  let recommendedStrategy: string | null = null;

  // Recommend strategy based on success rate
  if (extractionSuccessRate < 0.4) {
    recommendedStrategy = "ai-single-file";
    issues.push(
      "Low extraction success rate - recommend focusing on single files",
    );
  } else if (extractionSuccessRate < 0.7) {
    recommendedStrategy = "fuzzy";
    issues.push(
      "Moderate extraction issues - recommend fuzzy pattern matching",
    );
  }

  return {
    extractionSuccessRate,
    recommendedStrategy,
    issues,
  };
}

/**
 * Check if recovery strategies are being applied correctly
 */
function analyzeRecoveryUsage(context: SkillInvocationContext): {
  recoveryActive: boolean;
  currentTier: string | null;
  shouldEscalate: boolean;
} {
  const { metadata = {}, iteration = 0 } = context;

  const recoveryAttempts =
    (metadata.recoveryAttempts as Array<{
      tier: string;
      success: boolean;
    }>) || [];

  if (recoveryAttempts.length === 0) {
    return {
      recoveryActive: false,
      currentTier: null,
      shouldEscalate: iteration > 5, // Escalate after 5 iterations without recovery
    };
  }

  const latestRecovery = recoveryAttempts[recoveryAttempts.length - 1];

  return {
    recoveryActive: true,
    currentTier: latestRecovery.tier,
    shouldEscalate: !latestRecovery.success,
  };
}

/**
 * Autonomous Code Generation System Prompt
 */
const AUTONOMOUS_CODE_GENERATION_PROMPT = `# Autonomous Code Generation

## Purpose

Guide Ralph loop through reliable, autonomous code generation with smart extraction,
progressive recovery, and plan-based validation.

## Core Principles

### 1. Smart File Extraction

Extract file changes from AI output using progressive strategies:

**Strategy Hierarchy** (in order of preference):
1. **Strict** (confidence: 0.95) - Well-formatted code blocks with clear file paths
2. **Fuzzy** (0.75) - Common variations and looser patterns
3. **AI-JSON** (0.7) - AI returns structured JSON with file metadata
4. **AI-Single-File** (0.8) - Focus on one file at a time for clarity
5. **AI-Code-Mapping** (0.5) - AI suggests paths + descriptions
6. **AI-Assisted** (0.6) - Legacy fallback for unstructured output

**Extraction Confidence**:
- High (>0.8): Proceed with commit
- Medium (0.5-0.8): Review before commit
- Low (<0.5): Escalate to next strategy

**When to Escalate**:
- Extraction confidence < 0.5
- 3+ extraction failures in a row
- AI output lacks file markers

### 2. Progressive Recovery

When stuck or experiencing errors, apply recovery strategies in tiers:

**Tier 1: Format Guidance** (first attempt)
- Provide concrete examples of expected output
- Show code block format with file paths
- Reinforce extraction markers

**Tier 2: Simplified Prompts** (after Tier 1 fails)
- Break complex tasks into single-file changes
- Ask AI to identify most critical file
- Focus on minimal change scope

**Tier 3: Context Reset** (after Tier 2 fails)
- Clear conversation history
- Start fresh with minimal context
- Focus only on task + key requirements

**Tier 4: Manual Fallback** (after Tier 3 fails)
- Generate step-by-step instructions for user
- Mark task as stuck requiring intervention
- Preserve context for manual review

**Escalation Rules**:
- Escalate after 2 failed attempts at current tier
- Skip tiers if critical severity signals detected
- Never escalate without logging reason

### 3. Completion Validation

Before marking task complete, validate:

**Required Checks** (weighted):
1. **Completion Marker** (20%) - \`RALPH_COMPLETE\` in output
2. **Has Commits** (20%) - At least one commit made
3. **Matches Plan** (30%) - Implementation aligns with plan (≥50% file coverage)
4. **Quality Threshold** (15%) - Reasonable commit size (1-10k lines)
5. **Tests Executed** (5%) - Test artifacts present (optional)
6. **No Critical Errors** (10%) - No \`CRITICAL_ERROR\` markers

**Passing Score**: ≥80/100

**If Validation Fails**:
- Report specific failures to AI
- Request focused completion of missing items
- Do NOT claim completion prematurely

### 4. Iteration Management

**Healthy Iteration Pattern**:
- Iteration 1-3: Context gathering, initial implementation
- Iteration 4-6: Refinement, testing, commit
- Iteration 7+: Should be wrapping up or stuck

**Warning Signs**:
- No commits by iteration 5 → Check progress
- Repeated identical output → Stuck detector
- Extraction failures >50% → Change strategy
- No file modifications → Verify task clarity

## Output Format Requirements

**Code Changes**:
\`\`\`typescript:path/to/file.ts
// File content here
\`\`\`

**Completion Marker**:
\`\`\`
All changes complete.
RALPH_COMPLETE
\`\`\`

**Stuck Marker**:
\`\`\`
Unable to proceed due to [specific reason].
RALPH_STUCK: [detailed explanation]
\`\`\`

## Integration with Reliability Features

- **Stuck Detector**: Analyzes 5 signals (errors, patterns, quality, progress, timeout)
- **Recovery Orchestrator**: Auto-escalates through 4 tiers
- **Completion Validator**: Weighted scoring with AI-assisted plan matching
- **Smart Extractor**: Progressive strategies with confidence scoring

## Critical Rules

✓ Use strict extraction first, escalate only when needed
✓ Apply recovery strategies when stuck signals detected
✓ Validate completion before claiming done
✓ Log all extraction and recovery attempts

❌ Don't skip extraction confidence checks
❌ Don't claim completion without validation
❌ Don't repeat failed strategies without modification
❌ Don't proceed with low-confidence extractions without review

Remember: Autonomous execution requires systematic discipline, not optimistic assumptions.`;

/**
 * Autonomous Code Generation Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { phase, iteration = 0 } = context;

  // Only apply during execution
  if (phase !== "executing") {
    return {
      skillId: "autonomous-code-generation",
      status: "passed",
      message: "Not in execution phase - skill skipped",
      timestamp: new Date(),
    };
  }

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Analyze extraction quality
  const extractionAnalysis = analyzeExtractionQuality(context);
  if (extractionAnalysis.issues.length > 0) {
    issues.push(...extractionAnalysis.issues);

    if (extractionAnalysis.recommendedStrategy) {
      recommendations.push(
        `Switch to ${extractionAnalysis.recommendedStrategy} extraction strategy`,
      );
    }
  }

  // Analyze recovery usage
  const recoveryAnalysis = analyzeRecoveryUsage(context);
  if (recoveryAnalysis.shouldEscalate) {
    if (!recoveryAnalysis.recoveryActive) {
      recommendations.push(
        "Initiate recovery strategy (Tier 1: Format Guidance)",
      );
    } else {
      recommendations.push(
        `Escalate recovery from ${recoveryAnalysis.currentTier} to next tier`,
      );
    }
  }

  // Check iteration health
  if (iteration > 7 && context.commits?.length === 0) {
    issues.push("High iteration count with no commits - possible stuck state");
    recommendations.push("Apply systematic debugging or manual intervention");
  }

  // Provide guidance
  if (issues.length > 0 || recommendations.length > 0) {
    const issueSummary = issues.length > 0 ? issues.join("; ") : null;
    return {
      skillId: "autonomous-code-generation",
      status: "warning",
      message: issueSummary
        ? `Autonomous execution issues detected: ${issueSummary}`
        : "Autonomous execution issues detected - follow recommendations",
      augmentedPrompt: AUTONOMOUS_CODE_GENERATION_PROMPT,
      recommendations: [
        ...issues,
        "",
        "Recommendations:",
        ...recommendations,
        "",
        "Apply systematic approach:",
        "1. Check extraction confidence",
        "2. Escalate recovery if needed",
        "3. Validate before completion",
      ],
      metadata: {
        extractionSuccessRate: extractionAnalysis.extractionSuccessRate,
        recoveryActive: recoveryAnalysis.recoveryActive,
        iteration,
      },
      timestamp: new Date(),
    };
  }

  // Execution on track
  return {
    skillId: "autonomous-code-generation",
    status: "passed",
    message: "Autonomous execution on track - continue with current approach",
    metadata: {
      extractionSuccessRate: extractionAnalysis.extractionSuccessRate,
      iteration,
    },
    timestamp: new Date(),
  };
};

/**
 * Autonomous Code Generation Skill Definition
 */
export const autonomousCodeGeneration: SkillDefinition = {
  id: "autonomous-code-generation",
  name: "Autonomous Code Generation",
  description:
    "Guide Ralph loop with smart extraction, progressive recovery, and completion validation",
  category: "execution",
  enforcement: "guidance",
  triggerPhases: ["executing"],
  systemPrompt: AUTONOMOUS_CODE_GENERATION_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Loopforge",
};
