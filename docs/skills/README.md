# Loopforge Skills System

The Loopforge Skills System integrates the Superpowers framework for methodological discipline and workflow guidance across autonomous development.

## Overview

**What are Skills?**
Skills are automated checks and guides that enforce best practices during task execution. They automatically invoke at specific workflow phases to ensure quality, consistency, and reliability.

**Key Features:**

- ✅ **Automatic Invocation**: Skills trigger based on workflow phase (brainstorming, planning, executing, review)
- ✅ **Three Enforcement Types**: Blocking, Warning, Guidance
- ✅ **11 Skills Total**: 6 core Superpowers + 5 Loopforge-specific
- ✅ **Database Tracking**: All skill executions logged for debugging
- ✅ **Feature Flags**: Individual skill toggles for granular control

## Quick Start

### 1. Skills are Enabled by Default

No setup required! Skills automatically invoke during task processing.

### 2. Check Feature Flags (Optional)

```bash
# Global toggle (default: enabled)
ENABLE_SKILLS_SYSTEM=true

# Per-skill toggles (all default: enabled)
ENABLE_SKILL_TDD=true
ENABLE_SKILL_DEBUGGING=true
ENABLE_SKILL_VERIFICATION=true
ENABLE_SKILL_BRAINSTORMING=true
ENABLE_SKILL_WRITING_PLANS=true
ENABLE_SKILL_USING_SUPERPOWERS=true
ENABLE_SKILL_AUTONOMOUS_CODEGEN=true
ENABLE_SKILL_MULTI_AGENT=true
ENABLE_SKILL_GIT_WORKFLOW=true
ENABLE_SKILL_CONTEXT_ACCUMULATION=true
ENABLE_SKILL_PROMPT_ENGINEERING=true
```

### 3. Run Database Migration

```bash
npm run db:migrate
# Applies: 0030_skills_execution_tracking.sql
```

### 4. Skills Auto-Invoke by Phase

| Phase             | Skills Triggered                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **Brainstorming** | brainstorming, using-superpowers                                                                |
| **Planning**      | writing-plans, prompt-engineering, context-accumulation, using-superpowers                      |
| **Executing**     | test-driven-development, autonomous-code-generation, git-workflow-automation, using-superpowers |
| **Review**        | verification-before-completion                                                                  |
| **Stuck**         | systematic-debugging, using-superpowers                                                         |

## Available Skills

### Core Superpowers Skills

#### 1. Test-Driven Development (TDD)

- **Enforcement**: Blocking
- **Triggers**: Executing phase
- **Purpose**: Enforces Red-Green-Refactor cycle
- **Blocks if**:
  - Production code modified without tests
  - Tests pass immediately (no RED state observed)
  - Tests not executed before commit

**Example Block**:

```
BLOCKED: Tests not executed. Run tests to verify RED state.

Recommendations:
- Run: npm test (or appropriate test command)
- Verify test fails before implementation
- Document expected vs. actual output
```

#### 2. Systematic Debugging

- **Enforcement**: Blocking
- **Triggers**: Stuck, Executing phases
- **Purpose**: Requires root cause investigation before fixes
- **Blocks if**: No hypothesis, no error analysis, fix proposed without understanding

**Example Block**:

```
BLOCKED: Fix proposed without root cause investigation.

Missing steps:
- Error analysis (stack trace, error type, frequency)
- Hypothesis about root cause (what, why, how to verify)
- Verification of hypothesis (test, log output, reproduction)
```

#### 3. Verification Before Completion

- **Enforcement**: Blocking
- **Triggers**: Review, Executing phases
- **Purpose**: Requires evidence before completion claims
- **Blocks if**: No test evidence, no commits, plan coverage <80%

**Example Block**:

```
BLOCKED: Completion claimed without sufficient verification.

Critical issues:
- No test execution evidence
- Low plan coverage (45%) - review plan alignment

Run verification commands:
- npm test (show passing output)
- git status && git log -1 (verify commit)
- npm run build (verify build success)
```

#### 4. Brainstorming

- **Enforcement**: Guidance
- **Triggers**: Brainstorming phase
- **Purpose**: Guides Scrum-style backlog refinement
- **Framework**: Story clarity, acceptance criteria, task breakdown, dependencies, risks

#### 5. Writing Plans

- **Enforcement**: Warning
- **Triggers**: Planning phase
- **Purpose**: Ensures granular, testable implementation plans
- **Quality Score**: 1-5 based on granularity (target: 3+)

#### 6. Using Superpowers (Meta-Skill)

- **Enforcement**: Warning
- **Triggers**: All phases
- **Purpose**: Ensures other skills are invoked correctly
- **Checks**: Skill invocation discipline, recommends missing skills

### Loopforge-Specific Skills

#### 7. Autonomous Code Generation

- **Enforcement**: Guidance
- **Triggers**: Executing phase
- **Purpose**: Guides Ralph loop with smart extraction and recovery
- **Features**: Progressive strategies, recovery orchestration, completion validation

#### 8. Multi-Agent Coordination

- **Enforcement**: Guidance
- **Triggers**: Planning, Executing phases
- **Purpose**: Orchestrates parallel agent execution
- **Features**: DAG scheduling, conflict prevention, agent routing

#### 9. Git Workflow Automation

- **Enforcement**: Warning
- **Triggers**: Executing, Review phases
- **Purpose**: Automates branch naming, commits, test gates, PR creation
- **Conventions**: `loopforge/task-{id}` branches, conventional commits

#### 10. Context Accumulation

- **Enforcement**: Guidance
- **Triggers**: Brainstorming, Planning, Executing phases
- **Purpose**: Manages token budgets and conversation history
- **Triggers summarization**: At 60% of provider token limit

#### 11. Prompt Engineering

- **Enforcement**: Guidance
- **Triggers**: All phases
- **Purpose**: Applies KERNEL framework for prompt design
- **Quality Score**: 0-100 based on KERNEL checklist

## How Skills Work

### Invocation Flow

```
1. User creates task
   ↓
2. Task enters phase (e.g., "executing")
   ↓
3. System checks for applicable skills
   ↓
4. Skills invoke automatically
   ↓
5. Each skill validates requirements
   ↓
6. Skill returns result (passed/warning/blocked)
   ↓
7. Result persisted to database
   ↓
8. If blocked: Workflow pauses, user notified
   If warning: Workflow continues, recommendations shown
   If passed: Workflow continues
```

### Enforcement Types

**Blocking** (Prevents Progression):

- TDD, Systematic Debugging, Verification Before Completion
- Workflow cannot proceed until issues resolved
- User sees clear error message with recommendations

**Warning** (Recommends Improvements):

- Writing Plans, Git Workflow Automation, Using Superpowers
- Workflow continues, but recommendations provided
- User can address warnings before completion

**Guidance** (Augments AI Prompts):

- Brainstorming, Autonomous Code Generation, Multi-Agent Coordination, Context Accumulation, Prompt Engineering
- Adds methodological guidance to AI system prompts
- No blocking, enhances AI behavior

## Viewing Skill Results

### In Kanban UI

**Active Skills Badge**: Shows currently executing skills on card

```
┌─────────────────────┐
│ [TDD ✓] [Git ⚠]    │ ← Skill badges
│ Implement auth...   │
└─────────────────────┘
```

**Processing Popover**: Hover over executing card to see active skills

```
Executing
Progress: 45%
Active Skills:
[TDD] ✓ Passed
[AutoGen] ⚠ Low extraction confidence
```

### In Task Modal

**Skills Tab**: View complete execution history

```
Skills (3)
─────────────
Stats: 3 Total | 2 Passed | 1 Warning

Execution History:
✓ test-driven-development (2 min ago)
  "TDD cycle followed correctly: RED → GREEN verified"

⚠ git-workflow-automation (5 min ago)
  "Branch name does not follow convention"
  Recommendations:
  - Create branch: git checkout -b loopforge/task-123
```

### In Database

```sql
SELECT skill_executions FROM executions WHERE id = 'execution-id';
```

Returns:

```json
[
  {
    "skillId": "test-driven-development",
    "status": "passed",
    "message": "TDD cycle followed correctly",
    "timestamp": "2026-01-29T10:00:00.000Z",
    "metadata": { "testFiles": ["src/auth.test.ts"] }
  }
]
```

## Common Use Cases

### Debugging Stuck Tasks

**Problem**: Task stuck in executing phase

**Solution**:

1. Check Skills tab in task modal
2. Look for blocked skills
3. Follow recommendations to resolve

**Example**:

```
✗ verification-before-completion
  "BLOCKED: No test execution evidence"

Recommendations:
- Run: npm test
- Verify test output
- Commit results
```

### Understanding Skill Blocks

**Problem**: Task won't advance to "Done"

**Check Skills**:

- Review Skills tab for blocked status
- Read error message and recommendations
- Resolve each blocking issue
- Task will automatically unblock when criteria met

### Customizing Skill Behavior

**Disable Specific Skill**:

```bash
# Temporarily disable TDD skill
ENABLE_SKILL_TDD=false npm run dev
```

**Disable All Skills** (not recommended):

```bash
ENABLE_SKILLS_SYSTEM=false npm run dev
```

## Troubleshooting

### Skills Not Showing in UI

**Check**:

1. Is `ENABLE_SKILLS_SYSTEM=true`?
2. Has database migration run? (`npm run db:migrate`)
3. Are skills invoking? (Check console logs for `[Skills]` prefix)
4. Is task in correct phase? (Skills trigger per phase)

### Skill Blocking Incorrectly

**Debug**:

1. Check skill execution in database:
   ```sql
   SELECT skill_executions FROM executions WHERE task_id = ?;
   ```
2. Review skill logic in `lib/skills/core/` or `lib/skills/loopforge/`
3. Temporarily disable skill: `ENABLE_SKILL_<NAME>=false`
4. Report issue with skill execution details

### Performance Concerns

**Skills add <100ms overhead per invocation**

If experiencing slowdowns:

1. Check console for skill invocation logs
2. Disable non-critical guidance skills temporarily
3. Monitor database query performance
4. Review skill execution metadata for bottlenecks

## Next Steps

- **Create Custom Skills**: See `docs/skills/creating-skills.md`
- **Skill Reference**: See `docs/skills/skill-reference.md`
- **Integration Guide**: See `CLAUDE.md` "When Working with Skills" section

## Support

- **Issues**: https://github.com/anthropics/loopforge-studio/issues
- **Documentation**: `CLAUDE.md` (comprehensive context)
- **Examples**: `__tests__/skills/` (test files show usage)
