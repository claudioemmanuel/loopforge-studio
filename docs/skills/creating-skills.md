# Creating Custom Skills

This guide walks you through creating your own skills for Loopforge Studio.

## Prerequisites

- Basic TypeScript knowledge
- Understanding of Loopforge workflow phases
- Familiarity with existing skills (see `lib/skills/core/` and `lib/skills/loopforge/`)

## Skill Anatomy

Every skill has 5 core components:

```typescript
export const mySkill: SkillDefinition = {
  // 1. Metadata
  id: "my-skill",
  name: "My Skill",
  description: "What this skill does",
  category: "quality-discipline",
  enforcement: "blocking",

  // 2. Trigger Configuration
  triggerPhases: ["executing"],

  // 3. AI Guidance
  systemPrompt: `# My Skill\n\nInstructions for AI...`,

  // 4. Validation Logic
  executeLogic: async (context, client) => {
    // Your validation code here
    return {
      skillId: "my-skill",
      status: "passed",
      message: "All checks passed",
      timestamp: new Date(),
    };
  },

  // 5. Version Info
  version: "1.0.0",
  author: "Your Name",
};
```

## Step-by-Step Guide

### Step 1: Choose Skill Type

**Blocking Skills** (Prevent progression):

- Use for critical requirements (tests, security, quality gates)
- Examples: TDD, verification-before-completion
- User cannot proceed until skill passes

**Warning Skills** (Recommend improvements):

- Use for best practices that aren't critical
- Examples: writing-plans, git-workflow-automation
- User can proceed with warnings

**Guidance Skills** (Augment AI behavior):

- Use to guide AI without enforcing
- Examples: brainstorming, prompt-engineering
- Adds to system prompt, no blocking

### Step 2: Create Skill File

Create file in appropriate directory:

- Core methodology → `lib/skills/core/your-skill.ts`
- Loopforge-specific → `lib/skills/loopforge/your-skill.ts`

```bash
# Example: Create a code review skill
touch lib/skills/core/code-review.ts
```

### Step 3: Define Skill Metadata

```typescript
import type { SkillDefinition } from "../types";

export const codeReview: SkillDefinition = {
  id: "code-review",
  name: "Code Review",
  description: "Enforce code review checklist before PR creation",

  // Choose category
  category: "quality-discipline", // or: debugging, planning, execution, coordination, optimization, meta

  // Choose enforcement
  enforcement: "warning", // or: blocking, guidance

  // Choose trigger phases
  triggerPhases: ["review"], // Available: todo, brainstorming, planning, ready, executing, review, done, stuck

  version: "1.0.0",
  author: "Your Name",

  // ... systemPrompt and executeLogic below
};
```

### Step 4: Write System Prompt

System prompt guides the AI during skill execution:

```typescript
const CODE_REVIEW_PROMPT = `# Code Review Checklist

## Purpose
Ensure code quality before PR creation through systematic review.

## Checklist

### Code Quality
✓ No console.log() statements
✓ No commented-out code
✓ No TODO comments without tickets
✓ Consistent formatting
✓ No unused imports

### Tests
✓ Tests exist for new code
✓ Edge cases covered
✓ No skipped tests

### Documentation
✓ JSDoc for public functions
✓ README updated if needed
✓ CHANGELOG entry added

### Security
✓ No hardcoded secrets
✓ Input validation present
✓ No SQL injection risks

## Enforcement
This skill WARNS if checklist items are missing.
User can proceed but should address items before merging.
`;

export const codeReview: SkillDefinition = {
  // ... metadata ...
  systemPrompt: CODE_REVIEW_PROMPT,
  // ... executeLogic ...
};
```

### Step 5: Implement Validation Logic

```typescript
const executeLogic = async (
  context: SkillInvocationContext,
  client: AIClient,
): Promise<SkillResult> => {
  const { modifiedFiles = [], phase } = context;

  // Only run in review phase
  if (phase !== "review") {
    return {
      skillId: "code-review",
      status: "passed",
      message: "Not in review phase - skipping",
      timestamp: new Date(),
    };
  }

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check 1: Look for console.log in modified files
  for (const file of modifiedFiles) {
    if (file.includes("console.log")) {
      issues.push(`Found console.log in ${file}`);
      recommendations.push(`Remove console.log from ${file}`);
    }
  }

  // Check 2: Verify tests exist
  const hasTests = modifiedFiles.some((f) => f.includes(".test."));
  if (!hasTests && modifiedFiles.some((f) => !f.includes(".test."))) {
    issues.push("No test files found for code changes");
    recommendations.push("Add test files for new/modified code");
  }

  // Return result based on findings
  if (issues.length > 0) {
    return {
      skillId: "code-review",
      status: "warning", // or "blocked" for strict enforcement
      message: `Code review found ${issues.length} issues`,
      recommendations,
      metadata: {
        issues,
        filesReviewed: modifiedFiles.length,
      },
      timestamp: new Date(),
    };
  }

  return {
    skillId: "code-review",
    status: "passed",
    message: "Code review checklist passed",
    metadata: {
      filesReviewed: modifiedFiles.length,
    },
    timestamp: new Date(),
  };
};

export const codeReview: SkillDefinition = {
  // ... metadata ...
  systemPrompt: CODE_REVIEW_PROMPT,
  executeLogic,
};
```

### Step 6: Register Skill

Add to `lib/skills/index.ts`:

```typescript
// Import your skill
import { codeReview } from "./core/code-review";

// Export it
export { codeReview } from "./core/code-review";

// Register in initializeSkills()
export function initializeSkills(): void {
  // ... existing registrations ...

  registerSkill(codeReview, {
    featureFlag: "ENABLE_SKILL_CODE_REVIEW",
  });
}
```

### Step 7: Test Your Skill

Create test file in `__tests__/skills/core/code-review.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { codeReview } from "@/lib/skills/core/code-review";
import type { SkillInvocationContext } from "@/lib/skills/types";

describe("Code Review Skill", () => {
  const mockClient: any = {
    getProvider: () => "anthropic",
    getModel: () => "claude-sonnet-4",
  };

  it("should pass when no issues found", async () => {
    const context: SkillInvocationContext = {
      taskId: "test-123",
      phase: "review",
      taskDescription: "Test task",
      workingDir: "/test",
      modifiedFiles: ["src/utils.ts", "src/utils.test.ts"],
    };

    const result = await codeReview.executeLogic(context, mockClient);

    expect(result.status).toBe("passed");
    expect(result.message).toContain("passed");
  });

  it("should warn when console.log found", async () => {
    const context: SkillInvocationContext = {
      taskId: "test-123",
      phase: "review",
      taskDescription: "Test task",
      workingDir: "/test",
      modifiedFiles: ["src/debug.ts"], // Contains console.log
    };

    const result = await codeReview.executeLogic(context, mockClient);

    expect(result.status).toBe("warning");
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations!.length).toBeGreaterThan(0);
  });

  it("should skip when not in review phase", async () => {
    const context: SkillInvocationContext = {
      taskId: "test-123",
      phase: "executing",
      taskDescription: "Test task",
      workingDir: "/test",
    };

    const result = await codeReview.executeLogic(context, mockClient);

    expect(result.status).toBe("passed");
    expect(result.message).toContain("skipping");
  });
});
```

### Step 8: Enable and Test

```bash
# Enable your skill
export ENABLE_SKILL_CODE_REVIEW=true

# Run tests
npm test code-review.test.ts

# Start dev server
npm run dev

# Test in actual workflow:
# 1. Create task
# 2. Move to review phase
# 3. Check Skills tab in task modal
# 4. Verify skill executed and result shown
```

## Advanced Techniques

### Using AI for Validation

```typescript
const executeLogic = async (context, client) => {
  // Use AI to analyze code quality
  const prompt = `Analyze this file for code quality issues:

  ${fileContent}

  Return JSON: { "issues": ["issue1", "issue2"], "score": 0-100 }`;

  const response = await client.chat([
    { role: "user", content: prompt }
  ], { maxTokens: 1000 });

  const analysis = JSON.parse(response);

  if (analysis.score < 70) {
    return {
      skillId: "ai-code-review",
      status: "warning",
      message: `Code quality score: ${analysis.score}/100`,
      recommendations: analysis.issues,
      timestamp: new Date(),
    };
  }

  return { skillId: "ai-code-review", status: "passed", ... };
};
```

### Accessing File Contents

```typescript
import { readFile } from "fs/promises";
import { join } from "path";

const executeLogic = async (context, client) => {
  for (const file of context.modifiedFiles || []) {
    const filePath = join(context.workingDir, file);
    const content = await readFile(filePath, "utf-8");

    // Analyze content...
    if (content.includes("password")) {
      return { status: "blocked", message: "Hardcoded password detected!" };
    }
  }
};
```

### Skill Dependencies

```typescript
const executeLogic = async (context, client) => {
  // Check if another skill passed first
  const tddSkill = context.previousSkillExecutions?.find(
    (e) => e.skillId === "test-driven-development",
  );

  if (!tddSkill || tddSkill.status !== "passed") {
    return {
      status: "blocked",
      message: "TDD skill must pass before code review",
      recommendations: ["Ensure tests exist and pass"],
    };
  }

  // Continue with code review...
};
```

### Caching Results

```typescript
const executeLogic = async (context, client) => {
  // Check cache
  const cacheKey = `${context.taskId}:${context.iteration}`;
  const cached = skillCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  // Perform expensive validation...
  const result = { ... };

  // Cache result
  skillCache.set(cacheKey, result);

  return result;
};
```

## Best Practices

### DO:

✅ **Keep skills focused**: One responsibility per skill
✅ **Fail fast**: Return early when skill doesn't apply
✅ **Provide actionable recommendations**: Tell users exactly how to fix
✅ **Use clear messages**: Explain what failed and why
✅ **Test thoroughly**: Write unit tests for all code paths
✅ **Document in system prompt**: Explain skill's purpose and rules
✅ **Handle errors gracefully**: Catch exceptions, don't crash workflow

### DON'T:

❌ **Don't make skills too strict**: Allow reasonable flexibility
❌ **Don't skip error handling**: Always wrap risky operations in try-catch
❌ **Don't modify files**: Skills should only validate, not change code
❌ **Don't hardcode values**: Use configuration and metadata
❌ **Don't block unnecessarily**: Use warnings when possible
❌ **Don't ignore context phase**: Check phase before validating
❌ **Don't forget metadata**: Include useful debugging information

## Example Skills

### Security Scan Skill

```typescript
export const securityScan: SkillDefinition = {
  id: "security-scan",
  name: "Security Scan",
  description: "Detect common security vulnerabilities",
  category: "quality-discipline",
  enforcement: "blocking",
  triggerPhases: ["executing", "review"],

  systemPrompt: `# Security Scan\n\nChecks for common vulnerabilities:\n- SQL injection\n- XSS risks\n- Hardcoded secrets\n- Weak crypto`,

  executeLogic: async (context) => {
    const vulnerabilities = [];

    for (const file of context.modifiedFiles || []) {
      const content = await readFile(join(context.workingDir, file), "utf-8");

      // Check for SQL injection
      if (/\$\{.*\}.*query/i.test(content)) {
        vulnerabilities.push(`Potential SQL injection in ${file}`);
      }

      // Check for hardcoded secrets
      if (/api[_-]?key.*=.*["'][^"']{20,}["']/i.test(content)) {
        vulnerabilities.push(`Hardcoded API key in ${file}`);
      }
    }

    if (vulnerabilities.length > 0) {
      return {
        skillId: "security-scan",
        status: "blocked",
        message: `Found ${vulnerabilities.length} security vulnerabilities`,
        recommendations: vulnerabilities,
        timestamp: new Date(),
      };
    }

    return {
      skillId: "security-scan",
      status: "passed",
      message: "No vulnerabilities detected",
      timestamp: new Date(),
    };
  },

  version: "1.0.0",
  author: "Security Team",
};
```

## Troubleshooting

**Skill not executing**:

- Check feature flag: `ENABLE_SKILL_YOUR_SKILL=true`
- Verify trigger phase matches task phase
- Check console logs for `[Skills]` messages
- Ensure skill registered in `initializeSkills()`

**Skill blocking incorrectly**:

- Review validation logic
- Check context data availability
- Add logging to executeLogic
- Test with minimal reproduction case

**Performance issues**:

- Profile executeLogic with console.time()
- Cache expensive operations
- Consider making skill guidance instead of blocking
- Use async operations efficiently

## Resources

- **Type Definitions**: `lib/skills/types.ts`
- **Existing Skills**: `lib/skills/core/` and `lib/skills/loopforge/`
- **Tests**: `__tests__/skills/`
- **Integration**: `lib/ralph/loop.ts`, `lib/ai/brainstorm-chat.ts`, `lib/ai/plan.ts`

## Getting Help

- Review existing skills for patterns
- Check `CLAUDE.md` for integration points
- Test in isolation before integrating
- Ask in #skills channel for guidance
