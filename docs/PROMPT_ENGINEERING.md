# Prompt Engineering Framework for Loopforge Studio

This document establishes a systematic methodology for creating effective, reproducible prompts for AI agents in Loopforge Studio. It combines the practical KERNEL framework with Anthropic's context engineering principles to optimize token usage and agent performance.

---

## Table of Contents

1. [The KERNEL Framework](#the-kernel-framework)
2. [Context Engineering Principles](#context-engineering-principles)
3. [Token Optimization Strategies](#token-optimization-strategies)
4. [Loopforge-Specific Guidelines](#loopforge-specific-guidelines)
5. [Prompt Templates](#prompt-templates)
6. [Measurement & Verification](#measurement--verification)

---

## The KERNEL Framework

KERNEL is a mnemonic for creating effective prompts that work consistently across different AI providers and models.

### K = Keep It Simple

**Principle**: One prompt, one clear goal. Avoid over-explanation.

**Bad Example**:

```
I need you to understand that Redis is an in-memory data structure store that can be used as a database, cache, and message broker. It supports various data structures like strings, hashes, lists, sets, and more. With that context, I'd like you to create a comprehensive tutorial that covers basic concepts, advanced features, best practices, and common pitfalls while ensuring it's accessible to beginners but also valuable for experienced developers.
```

**Good Example**:

```
Write a Redis caching tutorial for intermediate developers. Include 3 practical examples.
```

**Application to Loopforge**:

- Task descriptions should be single-purpose
- Brainstorming prompts should focus on one architectural decision at a time
- Planning prompts should target one feature or bug fix

### E = Easy to Verify

**Principle**: Define measurable success criteria that both humans and AI can validate.

**Bad Example**:

```
Make the code better and more maintainable.
```

**Good Example**:

```
Refactor the authentication middleware to:
- Reduce cyclomatic complexity to < 10
- Add TypeScript strict mode compliance
- Include 3 test cases covering happy path, invalid token, and expired token
```

**Application to Loopforge**:

- Tasks should include acceptance criteria
- Plans should specify expected file changes
- Execution logs should track verifiable metrics (tests passed, linting errors, etc.)

### R = Reproducible Results

**Principle**: Avoid time-dependent or ambiguous references. Be specific.

**Bad Example**:

```
Use the latest best practices for React hooks.
```

**Good Example**:

```
Use React 19 hooks with TypeScript 5.7. Follow patterns from react-hook-form v7 documentation.
```

**Application to Loopforge**:

- Pin exact package versions in prompts
- Reference specific documentation URLs
- Include context snapshots (commit SHA, file versions)

### N = Narrow Scope

**Principle**: One prompt = one task. Split complex requests into sequential steps.

**Bad Example**:

```
Build a user authentication system with login, signup, password reset, email verification, OAuth integration, and role-based access control.
```

**Good Example** (Split into 6 tasks):

```
Task 1: Implement JWT-based login endpoint with email/password
Task 2: Add signup endpoint with email validation
Task 3: Create password reset flow with secure tokens
...
```

**Application to Loopforge**:

- Kanban tasks should represent atomic units of work
- Brainstorming should focus on one architectural decision
- Planning should break down features into 3-7 sequential steps

### E = Explicit Constraints

**Principle**: Tell the AI what NOT to do. Define boundaries clearly.

**Bad Example**:

```
Write a Python data processing script.
```

**Good Example**:

```
Write a Python 3.11 data processing script with these constraints:
- No external libraries except pandas and numpy
- Functions must be < 20 lines
- Include type hints for all parameters
- Handle missing data with null coalescing, not try/except
```

**Application to Loopforge**:

- Specify allowed dependencies
- Define code style rules (max line length, complexity limits)
- Declare prohibited patterns (no `any` types, no `console.log` in production)

### L = Logical Structure

**Principle**: Format prompts with clear sections for context, task, constraints, and output format.

**Template**:

```markdown
## Context

[Background information, relevant files, current state]

## Task

[Specific action to perform]

## Constraints

- [Constraint 1]
- [Constraint 2]

## Expected Output

[Format, structure, deliverables]
```

**Application to Loopforge**:

- System prompts in `lib/ralph/prompt-generator.ts` follow this structure
- Task descriptions in the database should use markdown sections
- Brainstorming conversations should separate problem space from solution space

---

## Context Engineering Principles

Based on Anthropic's research, effective context engineering requires treating tokens as a "precious, finite resource."

### The Golden Rule: Minimal High-Signal Tokens

**Principle**: Find the smallest possible set of high-signal tokens that maximize the likelihood of the desired outcome.

Every token depletes the model's finite attention budget. Context rot occurs as sequences grow longer because transformer architecture creates n² pairwise relationships for n tokens.

**Measurement**:

- Track input tokens per request
- Monitor response quality as context grows
- Set hard limits (e.g., max 50K tokens for brainstorming, 100K for execution)

### System Prompt Altitude

**Principle**: Balance specificity with flexibility. Avoid two extremes:

1. **Too Low (Brittle)**: Hardcoded if-else logic

   ```
   If the user asks about authentication, mention NextAuth.
   If they ask about database, mention Drizzle.
   If they ask about...
   ```

2. **Too High (Vague)**: Assumes false shared context

   ```
   Be helpful and follow best practices.
   ```

3. **Just Right (Heuristic)**: Specific guidance with flexible application
   ```
   For authentication tasks, prefer extending the existing NextAuth.js v5 setup
   in app/api/auth/[...nextauth]/route.ts rather than introducing new auth
   libraries. If a new library is necessary, justify the addition.
   ```

**Application to Loopforge**:

- Ralph's system prompt should provide architectural heuristics, not rigid rules
- Allow agents to make contextual decisions
- Include reasoning examples, not exhaustive case lists

### Organized Section Structure

Use XML tags or Markdown headers to delineate sections:

```xml
<background_information>
Loopforge Studio uses Next.js 15 with App Router, React 19, and TypeScript 5.7.
</background_information>

<instructions>
1. Read the existing component in components/kanban/kanban-board.tsx
2. Add drag-and-drop functionality using @dnd-kit/core
3. Preserve all existing props and event handlers
</instructions>

<constraints>
- Must work with React Server Components
- No additional bundle size > 50KB
- Maintain TypeScript strict mode compliance
</constraints>

<output_format>
Return a JSON object with:
{
  "changedFiles": ["path/to/file.tsx"],
  "reasoning": "Why this approach was chosen",
  "testStrategy": "How to verify it works"
}
</output_format>
```

### Iterative Prompt Development

Start minimal with capable models, then add clarity based on observed failures:

**Iteration 1** (Baseline):

```
Add dark mode support to the dashboard.
```

**Iteration 2** (After failure: inconsistent colors):

```
Add dark mode support to the dashboard using Tailwind's dark: modifier.
Use the existing color palette from tailwind.config.ts.
```

**Iteration 3** (After failure: missing toggle):

```
Add dark mode support to the dashboard:
1. Create a theme toggle component in components/layout/theme-toggle.tsx
2. Use next-themes for theme persistence
3. Apply Tailwind dark: modifiers to all components in app/(dashboard)
4. Use existing color palette from tailwind.config.ts
```

---

## Token Optimization Strategies

### 1. Just-in-Time Context Loading

**Principle**: Maintain lightweight identifiers (file paths, URLs) and dynamically load data via tools at runtime.

**Bad Example** (Front-loading):

```typescript
// Load entire codebase into context upfront
const systemPrompt = `
Here is the entire codebase:

${fs.readFileSync("app/page.tsx")}
${fs.readFileSync("components/kanban/kanban-board.tsx")}
... [50 more files]

Now, help me fix a bug in the task modal.
`;
```

**Good Example** (Just-in-Time):

```typescript
// Load only what's needed, when needed
const systemPrompt = `
You have access to a file_read tool. Use it to load files as needed.

Current task: Fix the task modal bug where it doesn't close on escape key.
Relevant files (identified by repo-scanner):
- components/modals/TaskModal.tsx
- components/modals/NewTaskModal.tsx
`;

// Agent decides which files to read based on investigation
```

**Application to Loopforge**:

- `lib/github/repo-scanner.ts` identifies relevant files without loading content
- Ralph loop uses tools to read files on demand
- Brainstorming phase loads summaries, not full file contents

### 2. Progressive Disclosure

**Principle**: Agents incrementally discover relevant context through exploration.

**Implementation**:

```typescript
// Step 1: Provide file tree structure
const fileTree = await generateFileTree(repoPath);

// Step 2: Agent requests specific directories
// Step 3: Agent reads individual files
// Step 4: Agent requests git history if needed
```

**Signals for Discovery**:

- File sizes (large files might be generated code)
- Naming conventions (\*.test.ts files contain tests)
- Timestamps (recently modified files are relevant to recent bugs)
- Import statements (reveals dependencies)

### 3. Context Compaction

**Principle**: Summarize conversation history nearing context limits, preserve critical information, restart with compressed context.

**Compaction Strategy**:

```typescript
interface CompactedContext {
  // High-signal preserved content
  architecturalDecisions: string[];
  unresolvedIssues: string[];
  fileChanges: { path: string; summary: string }[];

  // Lossy compression
  brainstormSummary: string; // 500 tokens instead of 10K
  executionSummary: string; // 1K tokens instead of 50K
}
```

**When to Compact**:

- Brainstorming: After 20 messages or 30K tokens
- Planning: After generating initial plan (compress research phase)
- Execution: After every 10 iterations (compress action history)

**Application to Loopforge**:

- Store compacted summaries in `tasks.brainstormConversation`
- Generate execution summaries in `executionLogs` table
- Ralph loop maintains a sliding window of recent actions (last 5), compresses older history

### 4. Sub-Agent Architectures

**Principle**: Specialized agents handle focused tasks with clean contexts, return condensed summaries to coordinating agent.

**Example Pattern**:

```typescript
// Main agent coordinates
const mainContext = {
  task: "Add real-time notifications",
  plan: "1. Research WebSocket libraries, 2. Design schema, 3. Implement...",
};

// Spawn sub-agent for step 1 (research)
const researchAgent = await spawnSubAgent({
  role: "library-researcher",
  context: {
    requirements: ["WebSocket support", "React hooks", "TypeScript"],
    constraints: ["< 50KB bundle", "Active maintenance"],
  },
});

// Sub-agent returns condensed summary (1-2K tokens)
const researchSummary = await researchAgent.execute();
// "Recommend socket.io-client v4.7.0: 23KB gzipped, 400K+ weekly downloads,
//  TypeScript support, React hooks via socket.io-react-hooks..."

// Main agent continues with compact summary, not full research context
```

**Application to Loopforge**:

- Brainstorming queue jobs run as isolated agents
- Planning queue jobs run as isolated agents
- Execution worker is the main coordinating agent
- Each phase returns a summary to the next

### 5. Tool Design for Token Efficiency

**Principle**: Self-contained, unambiguous functions with token-efficient returns.

**Bad Tool Design**:

```typescript
// Returns too much data
interface FileReadTool {
  read(path: string): string; // Returns entire 10K line file
}
```

**Good Tool Design**:

```typescript
// Returns targeted data
interface FileReadTool {
  read(
    path: string,
    options?: {
      lines?: { start: number; end: number };
      maxTokens?: number;
    },
  ): string;

  getSummary(path: string): {
    size: number;
    lines: number;
    exports: string[];
    imports: string[];
  };
}
```

**Application to Loopforge**:

- Ralph's tools should return summaries first
- Provide refinement tools to drill into details
- Avoid bloated tool sets (10 well-designed tools > 50 overlapping tools)

---

## Loopforge-Specific Guidelines

### Ralph Loop System Prompts

Located in `lib/ralph/prompt-generator.ts`, these prompts power the autonomous execution agent.

**Optimization Checklist**:

- [ ] Context section ≤ 5K tokens (repository summary, not full codebase)
- [ ] Instructions use imperative mood, numbered steps
- [ ] Constraints explicitly list prohibited actions
- [ ] Tool descriptions are ≤ 100 tokens each
- [ ] Examples show 2-3 canonical patterns, not edge cases
- [ ] Output format uses structured JSON, not prose

**Example Structure**:

```typescript
export function generateRalphSystemPrompt(context: RalphContext): string {
  return `
<background_information>
Repository: ${context.repoName}
Language: ${context.primaryLanguage}
Framework: ${context.framework}

Recent changes:
${context.recentCommits
  .slice(0, 3)
  .map((c) => `- ${c.message}`)
  .join("\n")}
</background_information>

<task>
${context.taskDescription}

Plan:
${context.plan}
</task>

<instructions>
1. Use file_read to examine relevant files
2. Use file_edit to make changes
3. Use git_commit when a logical unit is complete
4. Use mark_stuck if blocked for > 3 iterations
</instructions>

<constraints>
- Never commit directly to main/master
- Use branch: ${context.branchName}
- Follow existing code style (detected: ${context.codeStyle})
- Maximum 50 iterations before auto-marking as stuck
</constraints>

<tools>
${generateToolDescriptions()} <!-- Each tool ≤ 100 tokens -->
</tools>

<output_format>
{
  "thought": "One sentence reasoning",
  "action": "tool_name",
  "parameters": { ... }
}
</output_format>
`;
}
```

### Brainstorming Phase Prompts

Located in `lib/ai/brainstorm-chat.ts`, these prompts facilitate conversational planning.

**Optimization Checklist**:

- [ ] Initial context ≤ 3K tokens (task description + repo summary)
- [ ] Conversation history compacts after 20 messages
- [ ] User messages are preserved exactly
- [ ] AI responses are summarized after 5K tokens
- [ ] Architectural decisions are extracted and preserved

**Compaction Strategy**:

```typescript
function compactBrainstormHistory(messages: Message[]): Message[] {
  if (messages.length < 20) return messages;

  // Preserve first message (task context)
  const first = messages[0];

  // Preserve last 10 messages (recent conversation)
  const recent = messages.slice(-10);

  // Summarize middle messages
  const middle = messages.slice(1, -10);
  const summary = {
    role: "system",
    content: `Previous discussion summary:
- Considered approaches: ${extractApproaches(middle)}
- Key decisions: ${extractDecisions(middle)}
- Open questions: ${extractQuestions(middle)}`,
  };

  return [first, summary, ...recent];
}
```

### Planning Phase Prompts

Planning generates a structured execution plan in markdown format.

**Optimization Checklist**:

- [ ] Include only essential context (no full file dumps)
- [ ] Reference file paths, don't embed file contents
- [ ] Limit plan to 5-10 steps (split large tasks)
- [ ] Each step has clear inputs/outputs
- [ ] Include verification criteria per step

**Template**:

```markdown
# Execution Plan: [Task Title]

## Context

- Repository: [name]
- Branch: [branch-name]
- Related files: [file1.ts, file2.ts] (don't include content)

## Steps

### 1. [Step Name]

**Goal**: [What this accomplishes]
**Files**: [Which files to modify]
**Changes**: [High-level description]
**Verification**: [How to confirm it works]

### 2. [Next Step]

...

## Risks

- [Potential issue 1]
- [Mitigation strategy]

## Rollback Plan

If this fails: [Rollback steps]
```

### Task Descriptions

Users create tasks via the Kanban board. These descriptions seed the entire workflow.

**User Guidelines** (document in app UI):

```
✅ Good Task Descriptions:
- "Add pagination to the task list (20 items per page)"
- "Fix: Task modal doesn't close on Escape key"
- "Refactor: Split kanban-board.tsx into smaller components (< 200 lines each)"

❌ Poor Task Descriptions:
- "Make the app better" (too vague)
- "Fix all bugs" (too broad)
- "Add auth, emails, notifications, and analytics" (too many tasks)
```

---

## Prompt Templates

### Template 1: Feature Implementation

```markdown
## Context

Repository: [repo-name]
Current branch: [branch-name]
Relevant files: [identified by repo-scanner, don't load yet]

## Task

Implement [feature-name] with the following requirements:

- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## Constraints

- Use existing patterns from [example-file.ts]
- No new dependencies unless justified
- Maintain TypeScript strict mode
- Include tests in **tests**/[feature].test.ts

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] All tests pass (npm run test:run)
- [ ] No TypeScript errors (npm run type-check)

## Output Format

JSON:
{
"changedFiles": ["path/to/file"],
"testsAdded": ["path/to/test"],
"reasoning": "Why this approach"
}
```

### Template 2: Bug Fix

```markdown
## Context

Bug report: [description]
Observed behavior: [what's happening]
Expected behavior: [what should happen]
Steps to reproduce:

1. [Step 1]
2. [Step 2]

## Task

Identify and fix the root cause.

## Investigation Steps

1. Read the relevant files (paths suggested: [file1, file2])
2. Trace the execution flow
3. Identify the root cause
4. Propose a minimal fix

## Constraints

- Fix only the bug, don't refactor unrelated code
- Add a regression test
- No changes to public APIs

## Output Format

JSON:
{
"rootCause": "Explanation",
"filesChanged": ["path/to/file"],
"testAdded": "path/to/test.ts",
"reasoning": "Why this fix is minimal and safe"
}
```

### Template 3: Refactoring

```markdown
## Context

Current state: [description of code smell or technical debt]
Goal: [desired state]

## Task

Refactor [component/module] to improve [maintainability/performance/testability].

## Constraints

- No behavior changes (all existing tests must still pass)
- No new dependencies
- Maintain backward compatibility with [API/props/exports]

## Success Metrics

- Cyclomatic complexity: [before] → [target]
- Test coverage: [before%] → [target%]
- Bundle size: [before KB] → [target KB]

## Output Format

JSON:
{
"filesChanged": ["path/to/file"],
"metricsAchieved": {
"complexity": 8,
"coverage": 95,
"bundleSize": 45
},
"reasoning": "How refactoring improves codebase"
}
```

---

## Measurement & Verification

### Token Tracking

**Metrics to Monitor**:

```typescript
interface TokenMetrics {
  phase: "brainstorm" | "planning" | "execution";
  inputTokens: number;
  outputTokens: number;
  toolCallTokens: number;
  totalCost: number; // Estimate based on provider pricing
}
```

**Storage**: Add `tokenMetrics` JSONB column to `tasks` table.

**Thresholds**:

- Brainstorming: < 50K input tokens per task
- Planning: < 30K input tokens per task
- Execution: < 200K input tokens per task

**Alerts**: If a task exceeds thresholds, trigger a review:

- Is the task too broad? (split it)
- Is context being over-loaded? (use just-in-time loading)
- Is history compaction working? (check compression logic)

### Quality Metrics

**Success Rate**: Track task completion without getting stuck

```typescript
const successRate = completedTasks / (completedTasks + stuckTasks);
// Target: > 80%
```

**Iteration Efficiency**: Average iterations to complete a task

```typescript
const avgIterations = totalIterations / completedTasks;
// Target: < 20 iterations per task
```

**Token Efficiency**: Tokens per successful task

```typescript
const tokenEfficiency = totalTokens / completedTasks;
// Target: < 150K tokens per task
```

### A/B Testing Prompts

**Framework**:

1. Identify a prompt to optimize (e.g., Ralph's system prompt)
2. Create variant B with a hypothesis (e.g., "Adding examples will reduce iterations")
3. Run 10 tasks with prompt A, 10 with prompt B
4. Compare metrics: success rate, iterations, tokens
5. Adopt winner, iterate

**Example Hypothesis**:

```
Hypothesis: Adding 3 canonical examples of file_edit tool usage will reduce
average iterations by 20%.

Variant A (Control): Current prompt (no examples)
Variant B (Treatment): Prompt + 3 examples

Results after 20 tasks:
- Variant A: 18.5 avg iterations, 145K avg tokens
- Variant B: 14.2 avg iterations, 120K avg tokens
- Decision: Adopt variant B (23% fewer iterations, 17% fewer tokens)
```

### Prompt Version Control

Store prompts in git, tag versions, track performance:

```bash
# Tag a prompt version
git tag prompt-ralph-v1.0.2 -m "Added tool usage examples"

# Track metrics per version
{
  "version": "prompt-ralph-v1.0.2",
  "tasks": 127,
  "successRate": 0.87,
  "avgIterations": 14.2,
  "avgTokens": 120000
}
```

**Rollback Policy**: If a new prompt version degrades success rate by > 10%, immediately rollback.

---

## Summary

Effective prompts for Loopforge Studio require:

1. **Clarity** (KERNEL: Keep it simple, Easy to verify, Reproducible)
2. **Precision** (KERNEL: Narrow scope, Explicit constraints, Logical structure)
3. **Efficiency** (Context engineering: Minimal tokens, Just-in-time loading)
4. **Measurement** (Track tokens, quality metrics, A/B test)

**Golden Rules**:

- Treat tokens as a finite resource
- Load context just-in-time, not upfront
- Compress conversation history aggressively
- Structure prompts with clear sections
- Measure everything, optimize iteratively

**Next Steps**:

1. Audit existing prompts in `lib/ralph/prompt-generator.ts` against KERNEL
2. Implement token tracking in `tasks` table
3. Add context compaction to brainstorming and execution loops
4. Create A/B testing framework for prompt variants
5. Document prompt versions in git tags

---

**Last Updated**: 2026-01-29
**Framework Version**: 1.0.0
**Maintained By**: Loopforge Team
