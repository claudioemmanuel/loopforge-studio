/**
 * Writing Plans Skill
 *
 * Guides creation of comprehensive, actionable implementation plans.
 * Ensures plans are granular, testable, and executable by autonomous agents.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Analyze plan quality
 */
function analyzePlanQuality(plan: string | undefined): {
  hasSteps: boolean;
  hasAcceptanceCriteria: boolean;
  hasTestStrategy: boolean;
  granularityScore: number;
  issues: string[];
} {
  if (!plan) {
    return {
      hasSteps: false,
      hasAcceptanceCriteria: false,
      hasTestStrategy: false,
      granularityScore: 0,
      issues: ["No plan content provided"],
    };
  }

  const issues: string[] = [];

  // Check for steps/tasks
  const hasSteps =
    /step \d/i.test(plan) ||
    /task \d/i.test(plan) ||
    /\d\.\s/m.test(plan) ||
    /"id":\s*"\d+"/i.test(plan);

  if (!hasSteps) {
    issues.push("No numbered steps or tasks found");
  }

  // Check for acceptance criteria
  const hasAcceptanceCriteria =
    /acceptance criteria/i.test(plan) ||
    /definition of done/i.test(plan) ||
    /success criteria/i.test(plan);

  if (!hasAcceptanceCriteria) {
    issues.push("No acceptance criteria defined");
  }

  // Check for test strategy
  const hasTestStrategy =
    /test/i.test(plan) &&
    (/unit test/i.test(plan) ||
      /integration test/i.test(plan) ||
      /e2e test/i.test(plan));

  if (!hasTestStrategy) {
    issues.push("No test strategy defined");
  }

  // Granularity check: count steps and estimate size
  const stepMatches = plan.match(/step \d+|task \d+|\d+\.\s/gi) || [];
  const stepCount = stepMatches.length;

  // Granularity score: 1 (poor) to 5 (excellent)
  let granularityScore = 1;
  if (stepCount >= 3) granularityScore = 2;
  if (stepCount >= 5) granularityScore = 3;
  if (stepCount >= 8) granularityScore = 4;
  if (stepCount >= 10) granularityScore = 5;

  // Check for vague language
  const vaguePatterns = [
    /\bimplement\b.*\bfeature\b/i,
    /\bmake\b.*\bbetter\b/i,
    /\bfix\b.*\bissue\b/i,
    /\bimprove\b.*\bcode\b/i,
  ];

  for (const pattern of vaguePatterns) {
    if (pattern.test(plan)) {
      issues.push("Plan contains vague language - be more specific");
      break;
    }
  }

  return {
    hasSteps,
    hasAcceptanceCriteria,
    hasTestStrategy,
    granularityScore,
    issues,
  };
}

/**
 * Writing Plans System Prompt
 */
const WRITING_PLANS_PROMPT = `# Writing Implementation Plans

## Purpose

Transform refined requirements into granular, executable plans that guide autonomous implementation.

## KERNEL Framework for Plans

### K - Keep It Simple
- One clear goal per task
- Single responsibility per step
- No complex multi-step operations

### E - Easy to Verify
- Each step has testable completion criteria
- Explicit success markers
- Observable outcomes

### R - Reproducible
- Clear, unambiguous instructions
- No implied knowledge
- Repeatable by any executor

### N - Narrow Scope
- Tasks should be 2-5 minutes each
- Focus on single file or function when possible
- Defer non-critical work

### E - Explicit Constraints
- State what to do AND what NOT to do
- Define boundaries clearly
- Specify dependencies

### L - Logical Structure
- Order by dependencies
- Group related tasks
- Progressive complexity

## Plan Structure

\`\`\`json
{
  "sprintGoal": "Clear, measurable goal for this work",
  "overview": "High-level approach and architecture decisions",
  "steps": [
    {
      "id": "1",
      "title": "Concise task title (imperative form)",
      "description": "What to implement and how (specific files, functions)",
      "acceptanceCriteria": [
        "Testable condition 1",
        "Testable condition 2"
      ],
      "dependencies": ["0"], // IDs of prerequisite steps
      "estimatedEffort": "small|medium|large",
      "priority": "critical|high|medium|low"
    }
  ],
  "testStrategy": "How to verify implementation (unit, integration, e2e)",
  "rollbackPlan": "How to revert if something goes wrong"
}
\`\`\`

## Granularity Guidelines

**TOO LARGE** (>10 minutes):
❌ "Implement authentication system"
❌ "Refactor user service"

**GOOD SIZE** (2-5 minutes):
✓ "Add login() method to AuthService with JWT generation"
✓ "Extract user validation logic to validateUser() helper"
✓ "Write unit test for login() success case"

**TOO SMALL** (<1 minute):
❌ "Import lodash"
❌ "Add comment to function"

## Task Decomposition Pattern

For each feature:
1. **Setup** - File creation, imports, interfaces
2. **Core Logic** - Main functionality (one function/method at a time)
3. **Error Handling** - Edge cases, validation
4. **Tests** - Unit tests for each function
5. **Integration** - Connect to existing code
6. **Documentation** - Update README, add JSDoc

## Test Strategy Template

- **Unit Tests**: Test each function in isolation
  - Mock dependencies
  - Test happy path + edge cases
  - Aim for 80%+ coverage

- **Integration Tests**: Test component interactions
  - Database operations
  - API endpoints
  - Service integration

- **E2E Tests** (if applicable): Test user workflows
  - Critical user journeys
  - Cross-browser/platform

## Critical Rules

✓ **GRANULAR** - Tasks should be 2-5 minutes each
✓ **TESTABLE** - Every step has acceptance criteria
✓ **ORDERED** - Respect dependencies
✓ **SPECIFIC** - Name exact files, functions, variables
✓ **TDD-FIRST** - Write test tasks before implementation tasks

## Anti-Patterns

❌ "Implement feature" (too vague)
❌ "Fix bug" (no root cause)
❌ "Refactor code" (no target)
❌ Single giant task (not granular)
❌ No test tasks (quality risk)

✓ "Add login() method to src/auth.ts returning JWT"
✓ "Fix race condition in UserService.create() by adding mutex"
✓ "Extract validation logic to src/utils/validators.ts"
✓ Multiple small tasks (10+ for complex features)
✓ Test task for each implementation task

Remember: Detailed plans prevent wasted work and enable autonomous execution.`;

/**
 * Writing Plans Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { planContent, phase } = context;

  // Only enforce in planning phase
  if (phase !== "planning") {
    return {
      skillId: "writing-plans",
      status: "passed",
      message: "Not in planning phase - skill skipped",
      timestamp: new Date(),
    };
  }

  // If no plan yet, provide guidance
  if (!planContent || planContent.trim().length === 0) {
    return {
      skillId: "writing-plans",
      status: "warning",
      message:
        "No plan created yet. Use KERNEL framework and granular task breakdown.",
      augmentedPrompt: WRITING_PLANS_PROMPT,
      recommendations: [
        "Create granular tasks (2-5 minutes each)",
        "Define acceptance criteria for each task",
        "Include test strategy",
        "Order by dependencies",
      ],
      timestamp: new Date(),
    };
  }

  // Analyze plan quality
  const analysis = analyzePlanQuality(planContent);

  if (analysis.issues.length > 0 || analysis.granularityScore < 3) {
    return {
      skillId: "writing-plans",
      status: "warning",
      message: `Plan quality issues detected. Granularity score: ${analysis.granularityScore}/5`,
      augmentedPrompt: WRITING_PLANS_PROMPT,
      recommendations: [
        ...analysis.issues,
        "",
        "Improvement suggestions:",
        analysis.granularityScore < 3
          ? "Break tasks into smaller steps (aim for 8+ tasks)"
          : "",
        !analysis.hasTestStrategy ? "Add test strategy section" : "",
        !analysis.hasAcceptanceCriteria
          ? "Define acceptance criteria per task"
          : "",
      ].filter(Boolean),
      metadata: {
        granularityScore: analysis.granularityScore,
        issues: analysis.issues,
        hasSteps: analysis.hasSteps,
        hasAcceptanceCriteria: analysis.hasAcceptanceCriteria,
        hasTestStrategy: analysis.hasTestStrategy,
      },
      timestamp: new Date(),
    };
  }

  // Plan quality is good
  return {
    skillId: "writing-plans",
    status: "passed",
    message: `Plan approved. Granularity score: ${analysis.granularityScore}/5`,
    metadata: {
      granularityScore: analysis.granularityScore,
      hasSteps: true,
      hasAcceptanceCriteria: true,
      hasTestStrategy: true,
    },
    timestamp: new Date(),
  };
};

/**
 * Writing Plans Skill Definition
 */
export const writingPlans: SkillDefinition = {
  id: "writing-plans",
  name: "Writing Plans",
  description:
    "Guide creation of granular, testable implementation plans using KERNEL framework",
  category: "planning",
  enforcement: "warning",
  triggerPhases: ["planning"],
  systemPrompt: WRITING_PLANS_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Superpowers (adapted for Loopforge)",
};
