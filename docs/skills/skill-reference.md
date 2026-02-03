# Skills Reference

Complete reference for all available skills in Loopforge Studio.

## Quick Reference Table

| Skill                                             | Category     | Enforcement | Triggers                           | Purpose                     |
| ------------------------------------------------- | ------------ | ----------- | ---------------------------------- | --------------------------- |
| [TDD](#test-driven-development)                   | Quality      | Blocking    | Executing                          | Enforce Red-Green-Refactor  |
| [Debugging](#systematic-debugging)                | Debugging    | Blocking    | Stuck, Executing                   | Root cause analysis         |
| [Verification](#verification-before-completion)   | Quality      | Blocking    | Review, Executing                  | Evidence before completion  |
| [Brainstorming](#brainstorming)                   | Planning     | Guidance    | Brainstorming                      | Scrum refinement            |
| [Writing Plans](#writing-plans)                   | Planning     | Warning     | Planning                           | Granular plans              |
| [Using Superpowers](#using-superpowers)           | Meta         | Warning     | All                                | Skill invocation discipline |
| [Autonomous Codegen](#autonomous-code-generation) | Execution    | Guidance    | Executing                          | Ralph loop guidance         |
| [Multi-Agent](#multi-agent-coordination)          | Coordination | Guidance    | Planning, Executing                | Parallel execution          |
| [Git Workflow](#git-workflow-automation)          | Execution    | Warning     | Executing, Review                  | Branch/commit/PR automation |
| [Context](#context-accumulation)                  | Optimization | Guidance    | Brainstorming, Planning, Executing | Token management            |
| [Prompt Engineering](#prompt-engineering)         | Optimization | Guidance    | All                                | KERNEL framework            |

---

## Core Superpowers Skills

### Test-Driven Development

**ID**: `test-driven-development`
**File**: `lib/skills/core/test-driven-development.ts`
**Feature Flag**: `ENABLE_SKILL_TDD`

#### Overview

Enforces the TDD workflow: write failing test (RED), implement code (GREEN), refactor. Blocks commits that don't follow this cycle.

#### When It Triggers

- **Phase**: Executing
- **Condition**: Production code is being modified

#### What It Checks

1. **Test file exists**: Corresponding test file for modified production code
2. **Test execution**: Tests have been run (evidence in history)
3. **RED state observed**: Test was seen failing before implementation
4. **GREEN state achieved**: Test now passes after implementation

#### Blocking Conditions

- ✗ Production code modified without tests
- ✗ Tests pass immediately (no RED state)
- ✗ Tests not executed before commit

#### Example Scenarios

**✓ PASSED Example**:

```
Modified files:
- src/auth/login.ts
- __tests__/auth/login.test.ts

Test history:
1. Run 1: FAILED (RED state)
2. Run 2: PASSED (GREEN state)

Result: ✓ TDD cycle followed correctly
```

**✗ BLOCKED Example**:

```
Modified files:
- src/auth/login.ts

Test history: (empty)

Result: ✗ BLOCKED
Message: "Production code modified without tests. Write failing test first."
Recommendations:
- Create test file: __tests__/auth/login.test.ts
- Follow naming convention
- Ensure test fails first (RED state)
```

#### Configuration

None. Always enabled when `ENABLE_SKILL_TDD=true`.

#### Bypass

Only by setting `ENABLE_SKILL_TDD=false` (not recommended for quality).

---

### Systematic Debugging

**ID**: `systematic-debugging`
**File**: `lib/skills/core/systematic-debugging.ts`
**Feature Flag**: `ENABLE_SKILL_DEBUGGING`

#### Overview

Requires root cause investigation before proposing fixes. Prevents "guess and check" debugging.

#### When It Triggers

- **Phases**: Stuck, Executing
- **Condition**: Stuck signals detected OR errors occurring

#### What It Checks

1. **Error analysis**: Stack trace, error type, frequency documented
2. **Hypothesis**: Proposed explanation of root cause
3. **Verification**: Experiment or test validating hypothesis

#### Blocking Conditions

- ✗ Fix proposed without error analysis
- ✗ No hypothesis about root cause
- ✗ No verification attempt

#### The Scientific Method

```
1. OBSERVE - Gather facts about failure
2. HYPOTHESIZE - Form testable theories
3. EXPERIMENT - Test hypotheses systematically
4. ANALYZE - Understand why fix works
5. VERIFY - Confirm fix resolves issue
```

#### Example Scenarios

**✓ PASSED Example**:

```
Stuck signals: Consecutive errors (3)

Investigation metadata:
{
  "errorAnalysis": "TypeError: Cannot read property 'id' of undefined",
  "hypothesis": "User object not properly initialized before access",
  "verification": "Added null check, error disappeared"
}

Result: ✓ Systematic investigation complete
```

**✗ BLOCKED Example**:

```
Stuck signals: Consecutive errors (3)

Investigation metadata: (missing)

Result: ✗ BLOCKED
Message: "Fix proposed without root cause investigation"
Missing steps:
- Error analysis (stack trace, error type, frequency)
- Hypothesis about root cause
- Verification of hypothesis
```

---

### Verification Before Completion

**ID**: `verification-before-completion`
**File**: `lib/skills/core/verification-before-completion.ts`
**Feature Flag**: `ENABLE_SKILL_VERIFICATION`

#### Overview

Requires evidence before claiming work is complete. Prevents false completions.

#### When It Triggers

- **Phases**: Review, Executing
- **Condition**: Completion claim detected OR task moving to "done"

#### What It Checks (Weighted Scoring)

1. **Completion marker** (20%): `RALPH_COMPLETE` in output
2. **Has commits** (20%): At least one commit made
3. **Matches plan** (30%): Implementation aligns with plan (≥50% file coverage)
4. **Quality threshold** (15%): Reasonable commit size (1-10k lines)
5. **Tests executed** (5%): Test artifacts present
6. **No critical errors** (10%): No `CRITICAL_ERROR` markers

**Passing threshold**: 80/100

#### Blocking Conditions

- ✗ No test execution evidence
- ✗ Tests failing
- ✗ No commits made
- ✗ Plan coverage <50%
- ✗ Build failures

#### Example Scenarios

**✓ PASSED Example** (Score: 95/100):

```
Checks:
✓ Completion marker: Yes (20/20)
✓ Has commits: Yes (20/20)
✓ Matches plan: 85% coverage (30/30)
✓ Quality threshold: 2.5k lines (15/15)
✓ Tests executed: Yes (5/5)
✓ No critical errors: Yes (10/10)

Result: ✓ All verification checks passed
```

**✗ BLOCKED Example** (Score: 65/100):

```
Checks:
✓ Completion marker: Yes (20/20)
✓ Has commits: Yes (20/20)
✗ Matches plan: 30% coverage (9/30)
✓ Quality threshold: 1.2k lines (15/15)
✗ Tests executed: No (0/5)
✓ No critical errors: Yes (10/10)

Result: ✗ BLOCKED
Score: 74/100 (threshold: 80)
Failures:
- Low plan coverage (30%)
- No test execution evidence

Recommendations:
- Run npm test (show passing output)
- Review plan alignment
```

---

### Brainstorming

**ID**: `brainstorming`
**File**: `lib/skills/core/brainstorming.ts`
**Feature Flag**: `ENABLE_SKILL_BRAINSTORMING`

#### Overview

Guides Scrum-style backlog refinement during brainstorming phase.

#### When It Triggers

- **Phase**: Brainstorming
- **Condition**: Conversation active

#### What It Provides (Guidance)

1. **Story clarity**: Ensure "what" and "why" are clear
2. **Acceptance criteria**: Define testable "done" conditions
3. **Task breakdown**: Identify concrete implementation steps
4. **Dependencies**: Surface blockers and prerequisites
5. **Risks**: Identify challenges
6. **Estimation input**: Gather sizing information

#### Completeness Checks

- Has acceptance criteria
- Has task breakdown
- Has risk identification

#### Example Output

```
⚠ WARNING: Brainstorming incomplete

Missing elements:
- Acceptance criteria (specific, testable conditions)
- Risk identification (challenges, dependencies, blockers)

Recommendations:
- Define acceptance criteria
- Identify dependencies and risks
- Use Scrum framework to guide discussion
```

---

### Writing Plans

**ID**: `writing-plans`
**File**: `lib/skills/core/writing-plans.ts`
**Feature Flag**: `ENABLE_SKILL_WRITING_PLANS`

#### Overview

Ensures plans are granular, testable, and executable.

#### When It Triggers

- **Phase**: Planning
- **Condition**: Plan being generated

#### What It Checks

1. **Has steps**: Numbered tasks or steps
2. **Has acceptance criteria**: Per-task completion criteria
3. **Has test strategy**: Testing approach defined
4. **Granularity score**: 1-5 based on task count

**Granularity Scoring**:

- 1: <3 steps (too vague)
- 2: 3-4 steps
- 3: 5-7 steps (good)
- 4: 8-9 steps (very good)
- 5: 10+ steps (excellent)

#### Warning Conditions

- ⚠ Granularity score <3
- ⚠ No acceptance criteria
- ⚠ No test strategy
- ⚠ Vague language detected

#### Example Scenarios

**✓ PASSED Example** (Score: 4/5):

```
Plan analysis:
✓ Has 8 numbered steps
✓ Acceptance criteria per step
✓ Test strategy defined

Granularity score: 4/5

Result: ✓ Plan approved
```

**⚠ WARNING Example** (Score: 2/5):

```
Plan analysis:
✓ Has 3 numbered steps
✗ No acceptance criteria
✗ No test strategy

Granularity score: 2/5

Result: ⚠ WARNING
Issues:
- Plan contains vague language
- No acceptance criteria defined
- No test strategy

Recommendations:
- Break tasks into smaller steps (aim for 8+ tasks)
- Add acceptance criteria per task
- Add test strategy section
```

---

### Using Superpowers

**ID**: `using-superpowers`
**File**: `lib/skills/core/using-superpowers.ts`
**Feature Flag**: `ENABLE_SKILL_USING_SUPERPOWERS`

#### Overview

Meta-skill ensuring other skills are invoked correctly.

#### When It Triggers

- **Phases**: All (brainstorming, planning, executing, review, stuck)
- **Condition**: Always runs to check skill usage

#### What It Checks

- Have applicable skills been invoked for current phase?
- Are any skills being bypassed?

#### Example Output

```
⚠ WARNING: 2 applicable skills not yet invoked

Bypassed skills:
- test-driven-development: Enforce TDD workflow
- git-workflow-automation: Automate branch/commit/PR

Recommendations:
1. Check for applicable skills
2. Invoke skills in priority order
3. Follow skill guidance
4. Document skill usage
```

---

## Loopforge-Specific Skills

### Autonomous Code Generation

**ID**: `autonomous-code-generation`
**File**: `lib/skills/loopforge/autonomous-code-generation.ts`
**Feature Flag**: `ENABLE_SKILL_AUTONOMOUS_CODEGEN`

#### Overview

Guides Ralph loop with smart extraction, progressive recovery, and completion validation.

#### When It Triggers

- **Phase**: Executing
- **Condition**: Ralph loop iteration active

#### What It Provides

1. **Smart extraction guidance**: Progressive strategy recommendations
2. **Recovery orchestration**: Auto-escalation through 4 tiers
3. **Completion validation**: Plan matching and quality checks

#### Extraction Strategies

1. **Strict** (0.95 confidence): Well-formatted code blocks
2. **Fuzzy** (0.75): Common variations
3. **AI-JSON** (0.7): Structured JSON output
4. **AI-Single-File** (0.8): One file at a time
5. **AI-Code-Mapping** (0.5): Suggested paths
6. **AI-Assisted** (0.6): Fallback

#### Recovery Tiers

1. **Format Guidance**: Provide examples
2. **Simplified Prompts**: Single-file focus
3. **Context Reset**: Clear history
4. **Manual Fallback**: User intervention

---

### Multi-Agent Coordination

**ID**: `multi-agent-coordination`
**File**: `lib/skills/loopforge/multi-agent-coordination.ts`
**Feature Flag**: `ENABLE_SKILL_MULTI_AGENT`

#### Overview

Orchestrates parallel agent execution with DAG scheduling.

#### When It Triggers

- **Phases**: Planning, Executing
- **Condition**: Tasks can be parallelized

#### What It Detects

- Independent tasks (no shared files)
- Parallelization opportunities
- Dependency graphs

#### Example Output

```
⚠ Parallelization opportunity detected: 3 independent tasks

Can execute in parallel: task-1, task-2, task-3

Recommendations:
- Verify task independence (no shared files)
- Use DAG scheduling for execution order
- Route tasks to specialized agents
- Implement file locking for conflict prevention
- Merge results sequentially after parallel execution
```

---

### Git Workflow Automation

**ID**: `git-workflow-automation`
**File**: `lib/skills/loopforge/git-workflow-automation.ts`
**Feature Flag**: `ENABLE_SKILL_GIT_WORKFLOW`

#### Overview

Automates branch naming, conventional commits, and PR creation.

#### When It Triggers

- **Phases**: Executing, Review
- **Condition**: Git operations active

#### Conventions Enforced

1. **Branch naming**: `loopforge/task-{taskId}`
2. **Commit messages**: Conventional Commits format
3. **Co-Authored-By**: Claude trailer required
4. **Test gates**: Policy-based PR creation

#### Warning Conditions

- ⚠ Branch name doesn't follow convention
- ⚠ Commit message not conventional format
- ⚠ Tests failing (depends on policy)

---

### Context Accumulation

**ID**: `context-accumulation`
**File**: `lib/skills/loopforge/context-accumulation.ts`
**Feature Flag**: `ENABLE_SKILL_CONTEXT_ACCUMULATION`

#### Overview

Manages token budgets and triggers summarization.

#### When It Triggers

- **Phases**: Brainstorming, Planning, Executing
- **Condition**: Conversation active

#### Provider Limits

- **Anthropic**: 200K tokens (summarize at 120K / 60%)
- **OpenAI**: 128K tokens (summarize at 77K / 60%)
- **Gemini**: 1M tokens (summarize at 600K / 60%)

#### What It Monitors

- Total token count in conversation
- Percentage of provider limit used
- Critical context preservation

#### Example Output

```
⚠ Token usage at 65% of limit (83,200/128,000)

Recommendations:
- Trigger conversation summarization
- Extract and preserve critical context:
  * Acceptance criteria
  * Decisions made
  * Active risks
- Compress non-critical messages by 70%
- Preserve last 10 messages verbatim
```

---

### Prompt Engineering

**ID**: `prompt-engineering`
**File**: `lib/skills/loopforge/prompt-engineering.ts`
**Feature Flag**: `ENABLE_SKILL_PROMPT_ENGINEERING`

#### Overview

Applies KERNEL framework for prompt design.

#### When It Triggers

- **Phases**: All
- **Condition**: Prompt being constructed

#### KERNEL Checks

- **K**: Keep it simple (single clear goal)
- **E**: Easy to verify (success criteria)
- **R**: Reproducible (explicit output format)
- **N**: Narrow scope (focused constraints)
- **E**: Explicit constraints (DO/DON'T lists)
- **L**: Logical structure (organized sections)

#### Quality Score: 0-100

- Each KERNEL component: ~15-20 points
- 80+ = Ready to deploy
- <80 = Improvements needed

#### Example Output

```
⚠ Prompt quality score: 65/100

Issues:
- K: No clear goal or purpose stated
- E: No verifiable success criteria
- R: No explicit output format defined

Recommendations:
- Add ## Purpose or ## Goal section
- Add ## Success Criteria
- Add ## Output Format with JSON schema
```

---

## Feature Flags Reference

```bash
# Global toggle
ENABLE_SKILLS_SYSTEM=true          # Master switch (default: true)

# Core Skills
ENABLE_SKILL_TDD=true              # Test-driven development
ENABLE_SKILL_DEBUGGING=true        # Systematic debugging
ENABLE_SKILL_VERIFICATION=true     # Verification before completion
ENABLE_SKILL_BRAINSTORMING=true    # Brainstorming guidance
ENABLE_SKILL_WRITING_PLANS=true    # Writing plans
ENABLE_SKILL_USING_SUPERPOWERS=true # Using superpowers meta-skill

# Loopforge Skills
ENABLE_SKILL_AUTONOMOUS_CODEGEN=true    # Autonomous code generation
ENABLE_SKILL_MULTI_AGENT=true          # Multi-agent coordination
ENABLE_SKILL_GIT_WORKFLOW=true         # Git workflow automation
ENABLE_SKILL_CONTEXT_ACCUMULATION=true # Context accumulation
ENABLE_SKILL_PROMPT_ENGINEERING=true   # Prompt engineering
```

## Database Schema

Skill executions stored in `executions.skill_executions`:

```json
[
  {
    "skillId": "test-driven-development",
    "status": "passed",
    "message": "TDD cycle followed correctly: RED → GREEN verified",
    "timestamp": "2026-01-29T10:00:00.000Z",
    "metadata": {
      "testFiles": ["src/auth.test.ts"],
      "cycleComplete": true
    }
  }
]
```

## Integration Points

- **Ralph Loop**: `lib/ralph/loop.ts:202-260`
- **Brainstorming**: `lib/ai/brainstorm-chat.ts:176-215`
- **Planning**: `lib/ai/plan.ts:33-72`
- **Worker**: `workers/execution-worker.ts:1012-1056`

## Support

- **Documentation**: `docs/skills/README.md`, `docs/skills/creating-skills.md`
- **CLAUDE.md**: Comprehensive context (search "When Working with Skills")
- **Tests**: `__tests__/skills/` for usage examples
