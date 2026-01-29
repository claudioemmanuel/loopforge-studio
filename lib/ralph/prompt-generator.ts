import type { ProjectConfig } from "./types";

export interface PromptContext {
  project: string;
  changeId: string;
  iteration: number;
  workingDir: string;
  tasksPath: string;
  quickVerify: string;
  fullVerify: string;
  doConstraints: string[];
  dontConstraints: string[];
  // KERNEL optimization: codebase-aware constraints (2026-01-29)
  techStack?: string[];
  examplePatterns?: Record<string, string>;
}

export function generatePrompt(context: PromptContext): string {
  const doList = context.doConstraints.map((c) => `- ${c}`).join("\n");
  const dontList = context.dontConstraints.map((c) => `- ${c}`).join("\n");

  // Build tech stack section if available
  const techStackSection =
    context.techStack && context.techStack.length > 0
      ? `Tech Stack: ${context.techStack.join(", ")}`
      : "";

  // Build example patterns section if available
  const patternsSection =
    context.examplePatterns && Object.keys(context.examplePatterns).length > 0
      ? `\nExample Patterns:
${Object.entries(context.examplePatterns)
  .map(([name, location]) => `  - ${name}: ${location}`)
  .join("\n")}`
      : "";

  return `# Ralph Loop - Iteration ${context.iteration}

## 1. INPUT (Context)
Project: ${context.project}
Change: ${context.changeId}
Working directory: ${context.workingDir}
Tasks file: ${context.tasksPath}
${techStackSection}${patternsSection}

## 2. TASK (Your Role)
Read ${context.tasksPath}. Find the FIRST unchecked task (\`- [ ]\`) under "## ${context.changeId}".
Implement that single task ONLY.

## 3. CONSTRAINTS (Explicit Rules & Priorities)

### DO:
- Focus on ONE task only
- Follow existing patterns in the codebase${context.examplePatterns ? " (see Example Patterns above)" : ""}
- Keep changes minimal and focused
- Write tests if the project has them
- Use existing utilities and helpers
${doList ? doList : ""}

### DON'T:
- Modify unrelated code
- Skip verification steps
- Combine multiple tasks into one
- Add features not in the task
- Break existing functionality
${dontList ? dontList : ""}

### PRIORITY ORDER (when constraints conflict):
1. Security (no SQL injection, XSS, command injection, etc.)
2. Correctness (task requirements fully met)
3. Existing patterns (follow codebase conventions)
4. Code quality (readable, maintainable)
5. Style (formatting, comments)

## 4. AVAILABLE TOOLS (Usage Examples)

You have access to standard CLI tools. Here are common patterns:

### File Operations
\`\`\`bash
# Read file
cat path/to/file.ts

# Edit file (use heredoc for multi-line)
cat > path/to/file.ts << 'EOF'
export function example() {
  return "new content";
}
EOF

# Create directory
mkdir -p path/to/dir
\`\`\`

### Git Operations
\`\`\`bash
# Check status
git status

# Add specific files (prefer over git add .)
git add path/to/file1.ts path/to/file2.ts

# Commit with message
git commit -m "task(${context.changeId}): implement feature X"

# Check diff before committing
git diff --cached
\`\`\`

### Testing & Verification
\`\`\`bash
# Run tests
npm test

# Run linter
npm run lint

# Type check
npx tsc --noEmit
\`\`\`

## 5. OUTPUT FORMAT

### Completion Markers:
- Output \`RALPH_COMPLETE\` when ALL criteria met (see section 7)
- Output \`RALPH_STUCK: <detailed-reason>\` when blocked (see section 8)

### Workflow:
1. Implement the task
2. Run verification commands (see section 6)
3. Mark \`- [x]\` in ${context.tasksPath}
4. Commit: \`task(${context.changeId}): <task-id> - <description>\`
5. If ALL tasks under "## ${context.changeId}" are \`[x]\`: run full verify

## 6. VERIFICATION (Commands & Expected Outputs)

Before marking task complete, run:

1. **Quick Verify**
   Command: \`${context.quickVerify}\`
   Expected: Exit code 0, no errors in stderr

2. **Full Verify** (only if all tasks done)
   Command: \`${context.fullVerify}\`
   Expected: All tests pass, exit code 0

3. **Git Status**
   Command: \`git diff --check\`
   Expected: No trailing whitespace warnings

If ANY verification fails, fix issues before continuing.

## 7. SUCCESS CRITERIA (Checklist)

Mark \`RALPH_COMPLETE\` ONLY if ALL boxes checked:

□ Single task from ${context.tasksPath} implemented
□ All verification commands passed (section 6)
□ Task marked \`[x]\` in tasks file
□ Git commit created with proper format
□ No compilation/lint errors
□ Changes follow existing code patterns
□ No unrelated code modified

If ANY box unchecked, continue working or mark RALPH_STUCK.

## 8. ERROR HANDLING (Recovery Protocol)

### Max Retries:
- 2 retries per failed command
- After 2 failures, mark RALPH_STUCK with detailed reason

### Stuck Reason Format:
\`\`\`
RALPH_STUCK: <command> failed after 2 retries
Error: <stderr output>
Attempted:
- Retry 1: <what you tried>
- Retry 2: <what you tried>
\`\`\`

### Automatic Stuck Triggers:
- Same command fails 3+ times
- No progress after 5 iterations
- Required file/dependency unavailable
- Conflicting constraints detected
- Task requirements impossible to meet

### When to Mark Stuck:
If you encounter ANY of the above, immediately output RALPH_STUCK with detailed explanation.
DO NOT continue attempting after 2 failed retries.
`;
}

export function generatePromptFromConfig(
  config: ProjectConfig,
  changeId: string,
  iteration: number,
): string {
  return generatePrompt({
    project: config.name,
    changeId,
    iteration,
    workingDir: config.workingDir,
    tasksPath: config.tasksPath,
    quickVerify: config.quickVerify,
    fullVerify: config.fullVerify,
    doConstraints: config.constraints.do,
    dontConstraints: config.constraints.dont,
  });
}
