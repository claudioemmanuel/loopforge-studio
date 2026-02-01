/**
 * Brainstorming Skill
 *
 * Guides collaborative ideation and requirement refinement using Scrum-style backlog refinement.
 * Ensures clarity, acceptance criteria, and implementation readiness before planning.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Analyze brainstorm conversation for completeness
 */
function analyzeBrainstormCompleteness(
  conversation: Array<{ role: string; content: string }>,
): {
  hasAcceptanceCriteria: boolean;
  hasTaskBreakdown: boolean;
  hasRiskIdentification: boolean;
  missingElements: string[];
} {
  const conversationText = conversation.map((m) => m.content).join("\n");

  const hasAcceptanceCriteria =
    /acceptance criteria/i.test(conversationText) ||
    /definition of done/i.test(conversationText) ||
    /done when/i.test(conversationText);

  const hasTaskBreakdown =
    /steps/i.test(conversationText) ||
    /tasks/i.test(conversationText) ||
    /implementation/i.test(conversationText);

  const hasRiskIdentification =
    /risk/i.test(conversationText) ||
    /challenge/i.test(conversationText) ||
    /blocker/i.test(conversationText) ||
    /dependency/i.test(conversationText);

  const missingElements: string[] = [];
  if (!hasAcceptanceCriteria) {
    missingElements.push("Acceptance criteria (specific, testable conditions)");
  }
  if (!hasTaskBreakdown) {
    missingElements.push("Task breakdown (concrete implementation steps)");
  }
  if (!hasRiskIdentification) {
    missingElements.push(
      "Risk identification (challenges, dependencies, blockers)",
    );
  }

  return {
    hasAcceptanceCriteria,
    hasTaskBreakdown,
    hasRiskIdentification,
    missingElements,
  };
}

/**
 * Brainstorming System Prompt
 */
const BRAINSTORMING_PROMPT = `# Brainstorming & Requirement Refinement

## Purpose

Before implementation, deeply understand the task through collaborative refinement.
This skill guides Scrum-style backlog refinement to ensure clarity and readiness.

## SCRUM REFINEMENT FRAMEWORK

Your goal is to transform vague ideas into actionable, well-defined work.

### 1. STORY CLARITY
**Question**: What exactly are we building and why?

- What is the user story? (As a [role], I want [feature], so that [benefit])
- What problem does this solve?
- What does success look like?
- What is explicitly out of scope?

### 2. ACCEPTANCE CRITERIA
**Question**: How will we know when it's done?

- Define specific, testable conditions
- Use Given-When-Then format where applicable
- Include edge cases and error scenarios
- Specify non-functional requirements (performance, security, etc.)

Example:
✓ "User can log in with email and password"
✓ "Invalid credentials show error message"
✓ "Session expires after 24 hours"

### 3. TASK BREAKDOWN
**Question**: What are the concrete implementation steps?

- Identify technical components to build/modify
- Break into 2-5 minute incremental tasks
- Order by dependencies
- Include testing and documentation tasks

### 4. DEPENDENCIES
**Question**: What do we need before we can start?

- Existing code/APIs to integrate with
- External services or data sources
- Design assets or specifications
- Prerequisite tasks or decisions

### 5. RISKS & CHALLENGES
**Question**: What could go wrong or slow us down?

- Technical unknowns
- Performance/scalability concerns
- Security implications
- Integration complexity

### 6. ESTIMATION INPUT
**Question**: What helps estimate effort?

- Complexity indicators (simple, medium, complex)
- Similar past work for reference
- Amount of code to write/modify
- Number of tests needed

## Brainstorming Process

1. **Listen** - Understand the initial request
2. **Clarify** - Ask specific refinement questions
3. **Accumulate** - Build upon previous discussion (don't restart)
4. **Converge** - Know when enough clarity is reached
5. **Summarize** - Confirm understanding before planning

## Critical Rules

✓ **STAY ON TOPIC** - Questions must relate to the task
✓ **ACCUMULATE** - Build upon existing discussion, don't replace
✓ **BE SPECIFIC** - Use Scrum framework questions for this task
✓ **KNOW WHEN TO STOP** - After acceptance criteria, tasks, and risks identified

## When Brainstorming is Complete

Brainstorming is ready to transition to planning when you have:
- Clear user story and purpose
- Specific acceptance criteria (testable)
- High-level task breakdown
- Identified dependencies and risks

## Anti-Patterns

❌ "Let's build a feature" (too vague)
❌ "Make it better" (no criteria)
❌ "Fix the bug" (no root cause)

✓ "Add JWT authentication with 24h sessions, validated via unit tests"
✓ "Reduce API latency to <100ms at p95, measured via benchmarks"
✓ "Fix race condition in user service causing duplicate records"

Remember: Time spent in refinement saves exponentially more time in implementation.`;

/**
 * Brainstorming Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { brainstormHistory = [], phase } = context;

  // Only enforce in brainstorming phase
  if (phase !== "brainstorming") {
    return {
      skillId: "brainstorming",
      status: "passed",
      message: "Not in brainstorming phase - skill skipped",
      timestamp: new Date(),
    };
  }

  // If conversation just started, provide guidance
  if (brainstormHistory.length < 2) {
    return {
      skillId: "brainstorming",
      status: "warning",
      message:
        "Brainstorming started. Use Scrum refinement framework to explore requirements.",
      augmentedPrompt: BRAINSTORMING_PROMPT,
      recommendations: [
        "Ask clarifying questions about user story",
        "Define acceptance criteria",
        "Identify dependencies and risks",
      ],
      timestamp: new Date(),
    };
  }

  // Analyze completeness
  const analysis = analyzeBrainstormCompleteness(brainstormHistory);

  if (analysis.missingElements.length > 0) {
    return {
      skillId: "brainstorming",
      status: "warning",
      message: `Brainstorming incomplete. Missing: ${analysis.missingElements.join(", ")}`,
      augmentedPrompt: BRAINSTORMING_PROMPT,
      recommendations: [
        "Continue refinement conversation:",
        ...analysis.missingElements,
        "",
        "Use Scrum framework to guide discussion",
      ],
      metadata: {
        missingElements: analysis.missingElements,
        conversationLength: brainstormHistory.length,
      },
      timestamp: new Date(),
    };
  }

  // Brainstorming complete
  return {
    skillId: "brainstorming",
    status: "passed",
    message:
      "Brainstorming complete. Requirements refined and ready for planning.",
    metadata: {
      hasAcceptanceCriteria: true,
      hasTaskBreakdown: true,
      hasRiskIdentification: true,
      conversationLength: brainstormHistory.length,
    },
    timestamp: new Date(),
  };
};

/**
 * Brainstorming Skill Definition
 */
export const brainstorming: SkillDefinition = {
  id: "brainstorming",
  name: "Brainstorming",
  description:
    "Guide Scrum-style backlog refinement to ensure clarity and readiness before planning",
  category: "planning",
  enforcement: "guidance",
  triggerPhases: ["brainstorming"],
  systemPrompt: BRAINSTORMING_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Superpowers (adapted for Loopforge)",
};
