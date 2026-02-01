/**
 * Git Workflow Automation Skill
 *
 * Automates Git operations for autonomous development:
 * - Branch naming conventions (loopforge/task-{taskId})
 * - Conventional commit messages
 * - Test gate enforcement before PR
 * - PR creation with auto-approval logic
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Validate branch name follows convention
 */
function validateBranchName(
  branchName: string | undefined,
  taskId: string,
): { valid: boolean; expectedName: string; issues: string[] } {
  const expectedName = `loopforge/task-${taskId}`;
  const issues: string[] = [];

  if (!branchName) {
    issues.push("No branch name provided");
    return { valid: false, expectedName, issues };
  }

  if (branchName !== expectedName) {
    issues.push(
      `Branch name "${branchName}" does not follow convention "${expectedName}"`,
    );
    return { valid: false, expectedName, issues };
  }

  return { valid: true, expectedName, issues: [] };
}

/**
 * Validate commit message follows conventional commits
 */
function validateCommitMessage(message: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Conventional commit pattern: type(scope): description
  const conventionalPattern =
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\([a-z0-9-]+\))?: .{1,72}/;

  if (!conventionalPattern.test(message)) {
    issues.push("Commit message does not follow conventional commits format");
    issues.push(
      'Expected: type(scope): description (e.g., "feat(auth): add JWT validation")',
    );
    return { valid: false, issues };
  }

  // Check for Co-Authored-By trailer
  if (!message.includes("Co-Authored-By: Claude")) {
    issues.push("Missing Co-Authored-By: Claude Sonnet 4.5 trailer");
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Git Workflow Automation System Prompt
 */
const GIT_WORKFLOW_AUTOMATION_PROMPT = `# Git Workflow Automation

## Purpose

Automate Git operations for autonomous development with consistent conventions,
test gates, and PR creation.

## Branch Naming Convention

**Pattern**: \`loopforge/task-{taskId}\`

**Examples**:
- \`loopforge/task-123\` (task ID 123)
- \`loopforge/task-456-auth-refactor\` (optional description)

**Rules**:
- Always create feature branch from main
- Never commit directly to main/master
- Branch created automatically at task start
- Deleted after PR merge

**Branch Creation**:
\`\`\`bash
git checkout main
git pull origin main
git checkout -b loopforge/task-{taskId}
\`\`\`

## Commit Message Convention

**Format**: Conventional Commits

\`\`\`
type(scope): description

body (optional)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
\`\`\`

**Types**:
- \`feat\`: New feature
- \`fix\`: Bug fix
- \`docs\`: Documentation changes
- \`style\`: Formatting, no code change
- \`refactor\`: Code restructuring
- \`perf\`: Performance improvement
- \`test\`: Add/modify tests
- \`chore\`: Maintenance tasks
- \`ci\`: CI/CD changes
- \`build\`: Build system changes

**Examples**:
\`\`\`
feat(auth): add JWT token validation

Implements token expiration checking and refresh logic.
Includes unit tests for edge cases.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
\`\`\`

\`\`\`
fix(api): resolve race condition in user creation

Added mutex lock to prevent duplicate user records.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
\`\`\`

**Rules**:
- First line max 72 characters
- Use imperative mood ("add" not "added")
- Include scope when relevant
- Always add Co-Authored-By trailer
- Keep description concise

## Test Gate Enforcement

**Policies**:
1. **strict** - All tests must pass, no PR without green tests
2. **warn** - Tests can fail, warning added to PR (default)
3. **skip** - No test execution enforcement
4. **autoApprove** - Tests run, results logged, PR created regardless

**Critical Test Patterns**:
Configure per-repository:
\`\`\`json
{
  "criticalTestPatterns": ["auth", "payment", "security"]
}
\`\`\`

Any test matching these patterns MUST pass (even in "warn" mode).

**Test Execution**:
\`\`\`bash
npm test  # or appropriate test command
\`\`\`

**Test Gate Decision**:
- All tests pass → Create PR
- Non-critical tests fail + "warn" mode → Create PR with warning
- Critical tests fail → Block PR, move to review
- All tests fail + "strict" mode → Block PR

## PR Creation

**Automatic PR Creation**:
Triggered when:
1. Commits pushed to feature branch
2. Tests pass (or test gate allows)
3. \`RALPH_COMPLETE\` marker present

**PR Title Format**:
\`\`\`
[Task #{taskId}] Brief description
\`\`\`

**PR Body Template**:
\`\`\`markdown
## Summary
- Bullet point 1
- Bullet point 2

## Changes
- File 1: Description
- File 2: Description

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Related
Task: #{taskId}

🤖 Generated with [Loopforge Studio](https://loopforge.dev)
\`\`\`

**Auto-Approve Logic** (if enabled):
- All tests pass
- No critical test failures
- Commit quality check passes
- Plan coverage ≥80%

## Git Operations Workflow

\`\`\`
1. Create Branch
   git checkout -b loopforge/task-{taskId}
   ↓
2. Make Changes
   (iterative development)
   ↓
3. Stage Files
   git add <specific-files>
   ↓
4. Commit with Conventional Message
   git commit -m "type(scope): description\\n\\nCo-Authored-By: Claude"
   ↓
5. Run Tests
   npm test
   ↓
6. Test Gate Check
   (enforce based on policy)
   ↓
7. Push to Remote
   git push -u origin loopforge/task-{taskId}
   ↓
8. Create PR
   gh pr create --title "..." --body "..."
   ↓
9. Auto-Approve (if enabled and criteria met)
   gh pr review --approve
\`\`\`

## Critical Rules

✓ Always use feature branches (loopforge/task-{id})
✓ Follow conventional commit format
✓ Include Co-Authored-By trailer
✓ Run tests before push
✓ Respect test gate policy
✓ Create descriptive PR bodies

❌ Never commit directly to main/master
❌ Never skip test execution
❌ Never force push to main
❌ Never bypass test gates without justification
❌ Never create PRs without test results

## Error Handling

**Branch Exists**:
- Check if branch already exists
- If exists, checkout and pull latest
- If diverged, create new branch with suffix (-v2)

**Test Failures**:
- Log test output to execution logs
- If critical tests fail, block PR
- If non-critical fail in "warn" mode, create PR with warning

**Merge Conflicts**:
- Detect conflicts before push
- If conflicts exist, rebase on main
- If rebase fails, mark task as stuck

**PR Creation Failure**:
- Log error details
- Retry once with simplified PR body
- If still fails, create issue instead

Remember: Consistent Git workflow enables reliable autonomous development and easy code review.`;

/**
 * Git Workflow Automation Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { taskId, commits = [], metadata = {}, phase } = context;

  // Only apply during execution/review
  if (phase !== "executing" && phase !== "review") {
    return {
      skillId: "git-workflow-automation",
      status: "passed",
      message: "Not in execution/review phase - skill skipped",
      timestamp: new Date(),
    };
  }

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Validate branch name if provided
  const branchName = metadata.branchName as string | undefined;
  const branchValidation = validateBranchName(branchName, taskId);

  if (!branchValidation.valid) {
    issues.push(...branchValidation.issues);
    recommendations.push(
      `Create branch: git checkout -b ${branchValidation.expectedName}`,
    );
  }

  // Validate commit messages if commits exist
  if (commits.length > 0) {
    // In production, this would fetch actual commit messages
    // For now, we'll check if metadata has commit message validation
    const commitValidation = metadata.lastCommitMessage
      ? validateCommitMessage(metadata.lastCommitMessage as string)
      : { valid: false, issues: ["No commit message to validate"] };

    if (!commitValidation.valid) {
      issues.push(...commitValidation.issues);
      recommendations.push(
        "Follow conventional commits: type(scope): description",
      );
    }
  }

  // Check test gate status
  const testGatePolicy = (metadata.testGatePolicy as string) || "warn";
  const testsPass = (metadata.testsPass as boolean) ?? false;

  if (!testsPass && testGatePolicy === "strict") {
    issues.push("Tests failing - strict test gate blocks PR creation");
    recommendations.push("Fix failing tests before proceeding");
  }

  if (issues.length > 0) {
    return {
      skillId: "git-workflow-automation",
      status: "warning",
      message: `Git workflow issues detected: ${issues.length} problems`,
      augmentedPrompt: GIT_WORKFLOW_AUTOMATION_PROMPT,
      recommendations: [
        "Resolve the following Git workflow issues:",
        ...issues,
        "",
        "Recommendations:",
        ...recommendations,
      ],
      metadata: {
        branchValid: branchValidation.valid,
        expectedBranch: branchValidation.expectedName,
        testGatePolicy,
        testsPass,
      },
      timestamp: new Date(),
    };
  }

  // Git workflow on track
  return {
    skillId: "git-workflow-automation",
    status: "passed",
    message: "Git workflow conventions followed correctly",
    metadata: {
      branchValid: true,
      branchName: branchValidation.expectedName,
      testGatePolicy,
      testsPass,
    },
    timestamp: new Date(),
  };
};

/**
 * Git Workflow Automation Skill Definition
 */
export const gitWorkflowAutomation: SkillDefinition = {
  id: "git-workflow-automation",
  name: "Git Workflow Automation",
  description:
    "Automate branch naming, conventional commits, test gates, and PR creation",
  category: "execution",
  enforcement: "warning",
  triggerPhases: ["executing", "review"],
  systemPrompt: GIT_WORKFLOW_AUTOMATION_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Loopforge",
};
