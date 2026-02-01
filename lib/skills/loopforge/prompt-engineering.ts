/**
 * Prompt Engineering Skill
 *
 * Applies the KERNEL framework for systematic prompt design across all AI interactions.
 * Ensures prompts are simple, verifiable, reproducible, narrow, explicit, and logical.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Analyze prompt quality using KERNEL framework
 */
function analyzePromptQuality(prompt: string | undefined): {
  score: number;
  issues: string[];
  recommendations: string[];
} {
  if (!prompt || prompt.trim().length < 100) {
    return {
      score: 0,
      issues: ["No prompt provided or too short"],
      recommendations: ["Create prompt following KERNEL framework"],
    };
  }

  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // K - Keep it simple (single clear goal)
  if (!/^#.*goal|purpose|objective/im.test(prompt)) {
    issues.push("K: No clear goal or purpose stated");
    recommendations.push("Add ## Purpose or ## Goal section at start");
    score -= 15;
  }

  // E - Easy to verify (success criteria)
  if (
    !/success criteria|acceptance criteria|verification|validate/i.test(prompt)
  ) {
    issues.push("E: No verifiable success criteria");
    recommendations.push("Add ## Success Criteria or ## Verification section");
    score -= 15;
  }

  // R - Reproducible (explicit output format)
  if (!/output format|response format|json|structure/i.test(prompt)) {
    issues.push("R: No explicit output format defined");
    recommendations.push("Add ## Output Format with JSON schema or template");
    score -= 15;
  }

  // N - Narrow scope (focused constraints)
  if (!/do not|don't|avoid|never|constraints/i.test(prompt)) {
    issues.push("N: No explicit constraints or boundaries");
    recommendations.push(
      "Add ## Constraints or ## Rules section with DO/DON'T",
    );
    score -= 15;
  }

  // E - Explicit constraints (DO/DON'T lists)
  const hasDoDont = /✓|✗|❌|DO:|DON'T:|ALLOWED:|FORBIDDEN:/i.test(prompt);
  if (!hasDoDont) {
    issues.push("E: No DO/DON'T lists for explicit guidance");
    recommendations.push("Add explicit DO/DON'T lists with examples");
    score -= 20;
  }

  // L - Logical structure (organized sections)
  const hasStructure = /##\s/g.test(prompt);
  const sectionCount = (prompt.match(/##\s/g) || []).length;

  if (sectionCount < 3) {
    issues.push("L: Insufficient section organization");
    recommendations.push(
      "Organize into sections: Context → Instructions → Output → Verify",
    );
    score -= 20;
  }

  return { score, issues, recommendations };
}

/**
 * Prompt Engineering System Prompt
 */
const PROMPT_ENGINEERING_PROMPT = `# Prompt Engineering with KERNEL Framework

## Purpose

Apply systematic prompt design principles across all AI interactions in Loopforge.
Every prompt should follow the KERNEL framework for maximum effectiveness.

## KERNEL Framework

### K - Keep It Simple
**Principle**: One clear goal per prompt section

**Good**:
\`\`\`
## Goal
Generate a plan for implementing JWT authentication.
\`\`\`

**Bad**:
\`\`\`
"Please help me understand authentication and also create a plan
and maybe some code examples and documentation too"
\`\`\`

**Application**:
- Single responsibility per section
- Clear, focused objectives
- No complex multi-step operations in one prompt

### E - Easy to Verify
**Principle**: Explicit success criteria and completion markers

**Good**:
\`\`\`
## Success Criteria
□ JSON response with valid schema
□ All required fields present
□ Response within 2000 tokens
\`\`\`

**Completion Markers**:
- \`RALPH_COMPLETE\` for task completion
- \`RALPH_STUCK: <reason>\` for stuck states
- \`suggestComplete: true\` in brainstorming

**Application**:
- Testable completion conditions
- Observable outcomes
- Clear success/failure states

### R - Reproducible
**Principle**: Explicit output formats with examples

**Good**:
\`\`\`
## Output Format
{
  "sprintGoal": "string",
  "steps": [
    { "id": "1", "title": "string", "description": "string" }
  ]
}

Example:
{
  "sprintGoal": "Implement authentication",
  "steps": [{ "id": "1", "title": "Add JWT validation", ... }]
}
\`\`\`

**Application**:
- JSON schemas for structured data
- Template examples
- Fallback extraction when JSON fails

### N - Narrow Scope
**Principle**: Focus on single task or phase

**Good**:
\`\`\`
# Brainstorming Prompt
(Only handles brainstorming, not planning or execution)
\`\`\`

**Bad**:
\`\`\`
"Brainstorm AND create a plan AND start implementing"
\`\`\`

**Application**:
- One workflow phase per prompt
- Separate prompts for brainstorm/plan/execute
- Clear boundaries prevent scope creep

### E - Explicit Constraints
**Principle**: State what to do AND what NOT to do

**Good**:
\`\`\`
## Rules

DO:
✓ Focus on one task only
✓ Follow existing patterns
✓ Keep changes minimal

DON'T:
❌ Modify unrelated code
❌ Skip verification steps
❌ Combine multiple tasks
\`\`\`

**Application**:
- Positive examples (DO)
- Negative examples (DON'T)
- Edge case handling

### L - Logical Structure
**Principle**: Consistent section organization

**Standard Structure**:
\`\`\`
# Prompt Title

## Context (Input)
- What information is provided
- Current state
- Relevant background

## Role/Expertise
- AI's role in this task
- Domain knowledge to apply

## Instructions (Task)
- Step-by-step workflow
- Numbered or bulleted list

## Output Format
- Expected response structure
- JSON schema or template

## Success Criteria (Verify)
- How to know if task succeeded
- Completion markers
\`\`\`

**Application**:
- Follow same structure across all prompts
- Easy navigation for AI
- Systematic debugging

## Prompt Template

Use this template for all new prompts:

\`\`\`markdown
# [Prompt Name]

## Purpose
[One clear sentence describing the goal]

## Context
[What information is available]

## Role
You are an expert [role] with expertise in [domain].

## Instructions

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Output Format

\`\`\`json
{
  "field1": "description",
  "field2": ["array"],
  "field3": { "nested": "object" }
}
\`\`\`

## Rules

DO:
✓ [Positive instruction 1]
✓ [Positive instruction 2]

DON'T:
❌ [Negative instruction 1]
❌ [Negative instruction 2]

## Success Criteria

□ [Criterion 1]
□ [Criterion 2]
□ [Criterion 3]

## Completion Marker

When complete, output: TASK_COMPLETE
If blocked, output: TASK_BLOCKED: <reason>
\`\`\`

## Loopforge Prompt Examples

### Ralph Loop Prompt Structure
\`\`\`
# Ralph Loop - Iteration {N}

## Context (Input)
Project: {project}
Task: {taskId}
Working directory: {workingDir}

## Function (Task)
Implement the following plan:
{plan}

## Parameters (Constraints)
DO: ...
DON'T: ...

## Output (Format)
Code changes in format:
\`\`\`typescript:path/file.ts
...
\`\`\`

## Verify (Success)
□ Files extracted successfully
□ Changes committed
□ Tests pass
\`\`\`

### Planning Prompt Structure
\`\`\`
# Implementation Plan Generation

## Context
Task: {taskDescription}
Brainstorm: {brainstormSummary}

## Instructions
Create granular plan following KERNEL framework.

## Output Format
{JSON schema}

## Rules
DO: Tasks 2-5 minutes each
DON'T: Vague descriptions
\`\`\`

## Anti-Patterns to Avoid

❌ **Vague goals**: "Make the code better"
✅ **Specific goals**: "Reduce function length to <50 lines with extracted helpers"

❌ **Implicit expectations**: Assuming AI knows conventions
✅ **Explicit constraints**: "Follow patterns in lib/agents/definitions/code-reviewer.ts:15-45"

❌ **Mixed concerns**: Combining context, instructions, output
✅ **Separated sections**: Context section, Instructions section, Output section

❌ **No fallback**: Assuming AI always returns valid JSON
✅ **Robust parsing**: Markdown stripping + fallback extraction

❌ **Buried instructions**: Important constraints at end
✅ **Front-loaded**: Critical info in first 500 tokens

## Critical Rules

✓ Apply KERNEL framework to every new prompt
✓ Use consistent section structure
✓ Provide explicit examples in output format
✓ Include completion markers
✓ Front-load critical information

❌ Don't create prompts without KERNEL analysis
❌ Don't skip output format specification
❌ Don't assume AI understands implicit context
❌ Don't bury success criteria at the end
❌ Don't mix multiple concerns in one prompt

## Prompt Quality Checklist

Before deploying a prompt, verify:

□ K: Single clear goal stated
□ E: Success criteria defined
□ R: Output format specified with examples
□ N: Scope narrow and focused
□ E: DO/DON'T lists included
□ L: Logical section structure

Score: 6/6 = Ready to deploy

Remember: Well-engineered prompts are the foundation of reliable autonomous execution.`;

/**
 * Prompt Engineering Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { metadata = {}, phase } = context;

  // This skill provides guidance for all phases
  // Check if a prompt is being constructed
  const currentPrompt = metadata.currentPrompt as string | undefined;

  if (!currentPrompt) {
    return {
      skillId: "prompt-engineering",
      status: "passed",
      message:
        "No prompt construction detected - guidance available when needed",
      augmentedPrompt: PROMPT_ENGINEERING_PROMPT,
      timestamp: new Date(),
    };
  }

  // Analyze prompt quality
  const analysis = analyzePromptQuality(currentPrompt);

  if (analysis.score < 80) {
    return {
      skillId: "prompt-engineering",
      status: "warning",
      message: `Prompt quality score: ${analysis.score}/100 - improvements needed`,
      augmentedPrompt: PROMPT_ENGINEERING_PROMPT,
      recommendations: [
        `Current prompt quality: ${analysis.score}/100`,
        "",
        "Issues identified:",
        ...analysis.issues,
        "",
        "Recommendations:",
        ...analysis.recommendations,
        "",
        "Apply KERNEL framework checklist",
      ],
      metadata: {
        score: analysis.score,
        issues: analysis.issues,
        phase,
      },
      timestamp: new Date(),
    };
  }

  // Prompt quality is good
  return {
    skillId: "prompt-engineering",
    status: "passed",
    message: `Prompt quality excellent: ${analysis.score}/100`,
    metadata: {
      score: analysis.score,
      phase,
    },
    timestamp: new Date(),
  };
};

/**
 * Prompt Engineering Skill Definition
 */
export const promptEngineering: SkillDefinition = {
  id: "prompt-engineering",
  name: "Prompt Engineering",
  description:
    "Apply KERNEL framework for systematic prompt design across all AI interactions",
  category: "optimization",
  enforcement: "guidance",
  triggerPhases: ["brainstorming", "planning", "executing"],
  systemPrompt: PROMPT_ENGINEERING_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Loopforge",
};
