/**
 * Using Superpowers Meta-Skill
 *
 * Enforces skill invocation discipline - ensuring skills are used when applicable.
 * This meta-skill checks if other skills should be invoked and guides their usage.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";
import { getSkillsForPhase, getAllSkills } from "../registry";

/**
 * Detect if skills are being bypassed
 */
function detectSkillBypass(
  context: SkillInvocationContext,
  availableSkills: SkillDefinition[],
): {
  bypassedSkills: string[];
  recommendations: string[];
} {
  const { previousSkillExecutions = [], phase } = context;

  const phaseSkills = availableSkills.filter((s) =>
    s.triggerPhases.includes(phase),
  );

  const executedSkillIds = new Set(
    previousSkillExecutions.map((e) => e.skillId),
  );

  const bypassedSkills = phaseSkills
    .filter((s) => s.id !== "using-superpowers") // Don't count self
    .filter((s) => !executedSkillIds.has(s.id))
    .map((s) => s.id);

  const recommendations = bypassedSkills.map((skillId) => {
    const skill = availableSkills.find((s) => s.id === skillId);
    return `Consider using ${skill?.name || skillId}: ${skill?.description}`;
  });

  return { bypassedSkills, recommendations };
}

/**
 * Using Superpowers System Prompt
 */
const USING_SUPERPOWERS_PROMPT = `# Using Superpowers - Skill Invocation Discipline

## IRON LAW: CHECK FOR APPLICABLE SKILLS FIRST

You are enforcing skill usage discipline. Before ANY action, check if a skill applies (even 1% chance).

## The Rule

**Invoke relevant skills BEFORE any response or action.**

\`\`\`
User request → Check for skills → Invoke skills → Follow skill guidance → Take action
\`\`\`

## Red Flags (Stop and Check for Skills)

These thoughts mean you're rationalizing - STOP and check for skills:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE gathering context. |
| "Let me explore first" | Skills tell you HOW to explore. Check first. |
| "I can check files quickly" | Skills provide discipline. Check first. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Check current version. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |

## Skill Priority

When multiple skills apply:

1. **Process skills first** (brainstorming, debugging, writing-plans)
   - These determine HOW to approach the task

2. **Implementation skills second** (TDD, autonomous-code-generation)
   - These guide execution

## Available Skills by Phase

### Brainstorming Phase
- **brainstorming**: Scrum-style requirement refinement
- **using-superpowers**: Meta-skill (this one)

### Planning Phase
- **writing-plans**: Create granular implementation plans
- **prompt-engineering**: Apply KERNEL framework
- **context-accumulation**: Manage token budgets
- **using-superpowers**: Meta-skill

### Executing Phase
- **test-driven-development**: Enforce TDD workflow
- **autonomous-code-generation**: Guide Ralph loop
- **git-workflow-automation**: Automate branches/commits/PRs
- **verification-before-completion**: Require evidence
- **using-superpowers**: Meta-skill

### Stuck Phase
- **systematic-debugging**: Root cause investigation
- **using-superpowers**: Meta-skill

## Skill Invocation Pattern

Before each action:

1. **Identify phase** - What phase am I in? (brainstorming, planning, executing, etc.)
2. **List applicable skills** - What skills trigger for this phase?
3. **Check execution history** - Have these skills been invoked?
4. **Invoke missing skills** - Call skills that haven't been used yet
5. **Follow skill guidance** - Use skill prompts and execute logic

## Anti-Patterns

❌ Skipping skill check "to save time"
❌ "I know what the skill says" (invoke it anyway)
❌ Using skill content without invoking (violates discipline)
❌ Assuming skill doesn't apply without checking

✓ Check for skills before EVERY action
✓ Invoke skills even if "already know" the content
✓ Follow skill guidance systematically
✓ Document skill usage in metadata

## Enforcement

This meta-skill monitors skill usage and will:
- Warn if applicable skills were bypassed
- Recommend skills based on current phase and context
- Guide systematic skill invocation

Remember: Skills exist to prevent mistakes. Use them, even when confident.`;

/**
 * Using Superpowers Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { phase } = context;

  // Get all available skills
  const allSkills = getAllSkills();

  // Detect if skills are being bypassed
  const analysis = detectSkillBypass(context, allSkills);

  if (analysis.bypassedSkills.length > 0) {
    return {
      skillId: "using-superpowers",
      status: "warning",
      message: `${analysis.bypassedSkills.length} applicable skills not yet invoked for phase: ${phase}`,
      augmentedPrompt: USING_SUPERPOWERS_PROMPT,
      recommendations: [
        "Invoke the following skills before proceeding:",
        ...analysis.recommendations,
        "",
        "Use skill invocation discipline:",
        "1. Check for applicable skills",
        "2. Invoke skills in priority order",
        "3. Follow skill guidance",
        "4. Document skill usage",
      ],
      metadata: {
        bypassedSkills: analysis.bypassedSkills,
        currentPhase: phase,
      },
      timestamp: new Date(),
    };
  }

  // All skills invoked correctly
  return {
    skillId: "using-superpowers",
    status: "passed",
    message:
      "Skill invocation discipline followed. All applicable skills invoked.",
    metadata: {
      currentPhase: phase,
      skillsChecked: true,
    },
    timestamp: new Date(),
  };
};

/**
 * Using Superpowers Skill Definition
 */
export const usingSuperpowers: SkillDefinition = {
  id: "using-superpowers",
  name: "Using Superpowers",
  description:
    "Enforce skill invocation discipline - check for applicable skills before any action",
  category: "meta",
  enforcement: "warning",
  triggerPhases: ["brainstorming", "planning", "executing", "review", "stuck"],
  systemPrompt: USING_SUPERPOWERS_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Superpowers (adapted for Loopforge)",
};
