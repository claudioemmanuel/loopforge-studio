/**
 * Review Gate - Mandatory code review before committing changes
 */

import type { ReviewResult, ReviewIssue } from "@/lib/agents/types";
import type { AIClient, ChatMessage } from "@/lib/ai/client";
import { Agents } from "@/lib/agents/registry";

interface ReviewContext {
  /** Title of the task being reviewed */
  taskTitle: string;
  /** The changes/output from the agent */
  changes: string;
  /** List of modified files */
  modifiedFiles: string[];
  /** Additional context about the task */
  context?: string;
}

interface ReviewOptions {
  /** AI client for the review */
  client: AIClient;
  /** Progress callback */
  onProgress?: (message: string) => void | Promise<void>;
  /** Maximum tokens for review response */
  maxTokens?: number;
}

/**
 * Generate the review prompt
 */
function generateReviewPrompt(context: ReviewContext): string {
  return `# Code Review Request

## Task Completed
**${context.taskTitle}**

## Files Modified
${context.modifiedFiles.map((f) => `- ${f}`).join("\n") || "No files explicitly listed"}

## Changes Made
${context.changes}

${context.context ? `## Additional Context\n${context.context}` : ""}

## Review Instructions
Please review the changes above for:
1. **Security** - Any vulnerabilities (injection, XSS, auth bypass, etc.)
2. **Correctness** - Logic errors, edge cases, error handling
3. **Quality** - Code complexity, maintainability, naming
4. **Style** - Consistency with typical patterns

## Required Output
Respond with a JSON object exactly in this format:
\`\`\`json
{
  "passed": true/false,
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "description": "Description of the issue",
      "filePath": "path/to/file.ts",
      "suggestion": "How to fix it"
    }
  ],
  "feedback": "Overall summary (1-2 sentences)"
}
\`\`\`

Rules:
- "passed": false if any critical or high severity issues
- "passed": true if only medium/low issues or no issues
- Be thorough but fair - don't block for minor style issues
`;
}

/**
 * Parse the review response into a structured result
 */
function parseReviewResponse(response: string): ReviewResult {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonContent = jsonMatch ? jsonMatch[1] : response;

  try {
    const parsed = JSON.parse(jsonContent.trim());

    // Validate the structure
    if (typeof parsed.passed !== "boolean") {
      throw new Error("Missing 'passed' field");
    }

    const issues: ReviewIssue[] = [];
    if (Array.isArray(parsed.issues)) {
      for (const issue of parsed.issues) {
        if (issue.severity && issue.description) {
          issues.push({
            severity: issue.severity,
            description: issue.description,
            filePath: issue.filePath,
            lineNumber: issue.lineNumber,
            suggestion: issue.suggestion,
          });
        }
      }
    }

    return {
      passed: parsed.passed,
      issues,
      feedback: parsed.feedback || "",
      suggestions: parsed.suggestions,
    };
  } catch {
    // If JSON parsing fails, try to extract information from text
    const passed = !response.toLowerCase().includes("critical") &&
                   !response.toLowerCase().includes("high severity") &&
                   !response.toLowerCase().includes("security vulnerability") &&
                   !response.toLowerCase().includes("must fix");

    return {
      passed,
      issues: [],
      feedback: response.substring(0, 500),
    };
  }
}

/**
 * Execute a code review on changes
 */
export async function executeReview(
  context: ReviewContext,
  options: ReviewOptions
): Promise<ReviewResult> {
  const { client, onProgress, maxTokens = 4096 } = options;

  await onProgress?.(`Starting code review for "${context.taskTitle}"...`);

  // Get the code reviewer agent's system prompt
  const reviewerAgent = Agents.codeReviewer;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: reviewerAgent.systemPrompt,
    },
    {
      role: "user",
      content: generateReviewPrompt(context),
    },
  ];

  try {
    const response = await client.chat(messages, { maxTokens, temperature: 0.1 });

    await onProgress?.(`Review completed for "${context.taskTitle}"`);

    return parseReviewResponse(response);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await onProgress?.(`Review failed: ${errorMessage}`);

    // On error, default to blocking (fail closed for safety)
    return {
      passed: false,
      issues: [
        {
          severity: "high",
          description: `Review process failed: ${errorMessage}`,
          suggestion: "Retry the review",
        },
      ],
      feedback: `Code review failed due to error: ${errorMessage}`,
    };
  }
}

/**
 * Check if a review result has blocking issues
 */
export function hasBlockingIssues(review: ReviewResult): boolean {
  return review.issues.some(
    (issue) => issue.severity === "critical" || issue.severity === "high"
  );
}

/**
 * Get a summary of review issues by severity
 */
export function getIssueSummary(review: ReviewResult): string {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const issue of review.issues) {
    counts[issue.severity]++;
  }

  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} critical`);
  if (counts.high > 0) parts.push(`${counts.high} high`);
  if (counts.medium > 0) parts.push(`${counts.medium} medium`);
  if (counts.low > 0) parts.push(`${counts.low} low`);

  return parts.length > 0 ? parts.join(", ") : "No issues";
}

/**
 * Format review result for display
 */
export function formatReviewResult(review: ReviewResult): string {
  const lines: string[] = [
    `## Code Review Result`,
    ``,
    `Status: ${review.passed ? "✅ Passed" : "❌ Failed"}`,
    ``,
    `### Feedback`,
    review.feedback,
  ];

  if (review.issues.length > 0) {
    lines.push(``, `### Issues (${getIssueSummary(review)})`);

    for (const issue of review.issues) {
      const emoji =
        issue.severity === "critical"
          ? "🚨"
          : issue.severity === "high"
            ? "🔴"
            : issue.severity === "medium"
              ? "🟡"
              : "🟢";

      lines.push(`${emoji} **${issue.severity.toUpperCase()}**: ${issue.description}`);
      if (issue.filePath) {
        lines.push(`   File: ${issue.filePath}${issue.lineNumber ? `:${issue.lineNumber}` : ""}`);
      }
      if (issue.suggestion) {
        lines.push(`   Suggestion: ${issue.suggestion}`);
      }
    }
  }

  if (review.suggestions?.length) {
    lines.push(``, `### Suggestions`);
    for (const suggestion of review.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join("\n");
}

/**
 * Retry task execution with review feedback
 */
export function buildRetryPrompt(
  originalTask: string,
  reviewFeedback: ReviewResult
): string {
  return `# Retry Task with Feedback

## Original Task
${originalTask}

## Previous Attempt Failed Code Review

### Feedback
${reviewFeedback.feedback}

### Issues to Fix
${reviewFeedback.issues
  .map(
    (issue) =>
      `- [${issue.severity.toUpperCase()}] ${issue.description}${issue.suggestion ? ` (Suggestion: ${issue.suggestion})` : ""}`
  )
  .join("\n")}

## Instructions
Please re-implement the task, addressing all the issues mentioned above.
Focus especially on:
${reviewFeedback.issues
  .filter((i) => i.severity === "critical" || i.severity === "high")
  .map((i) => `- ${i.description}`)
  .join("\n") || "- All issues mentioned"}

When complete, end your response with:
\`\`\`
TASK_COMPLETE
\`\`\`
`;
}
