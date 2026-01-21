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
}

export function generatePrompt(context: PromptContext): string {
  const doList = context.doConstraints.map((c) => `- ${c}`).join("\n");
  const dontList = context.dontConstraints.map((c) => `- ${c}`).join("\n");

  return `# Ralph Loop - Iteration ${context.iteration}

## Context (Input)
Project: ${context.project}
Change: ${context.changeId}
Working directory: ${context.workingDir}
Tasks file: ${context.tasksPath}

## Task (Function)
Read ${context.tasksPath}. Find the FIRST unchecked task (\`- [ ]\`) under "## ${context.changeId}".
Implement that single task.

## Constraints (Parameters)

DO:
- Focus on ONE task only
- Follow existing patterns in the codebase
- Keep changes minimal and focused
- Write tests if the project has them
- Use existing utilities and helpers

DON'T:
- Modify unrelated code
- Skip verification steps
- Combine multiple tasks into one
- Add features not in the task
- Break existing functionality

## Format (Output)
1. Implement the task
2. Run: \`${context.quickVerify}\`
3. If passes: mark \`- [x]\` in ${context.tasksPath}
4. Commit: \`task(${context.changeId}): <task-id> - <description>\`
5. If ALL tasks under "## ${context.changeId}" are \`[x]\`: run \`${context.fullVerify}\`
6. If all pass: output \`RALPH_COMPLETE\`
7. If stuck 3+ times on same issue: output \`RALPH_STUCK: <reason>\`

## Verify (Success Criteria)
- [ ] Single task implemented
- [ ] \`${context.quickVerify}\` exits 0
- [ ] Task marked [x] in tasks.md
- [ ] Git commit created with proper format

## Project-Specific Constraints

### DO:
${doList}

### DON'T:
${dontList}
`;
}

export function generatePromptFromConfig(
  config: ProjectConfig,
  changeId: string,
  iteration: number
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
