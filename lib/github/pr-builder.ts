/**
 * PR Builder - Generates comprehensive PR descriptions from task data
 */

import type { Task, TestRun, Execution, Repo } from "@/lib/db/schema";

export interface PrBuildOptions {
  task: Task;
  repo: Repo;
  execution?: Execution;
  testRun?: TestRun | null;
  filesChanged?: string[];
  commitMessages?: string[];
}

export interface PrContent {
  title: string;
  body: string;
  draft: boolean;
  labels: string[];
  reviewers: string[];
}

/**
 * Build PR content from task data
 */
export function buildPrContent(options: PrBuildOptions): PrContent {
  const {
    task,
    repo,
    execution,
    testRun,
    filesChanged = [],
    commitMessages = [],
  } = options;

  // Build title using template or default
  const title = buildTitle(task, repo);

  // Build body
  const body = buildBody({
    task,
    execution,
    testRun,
    filesChanged,
    commitMessages,
  });

  return {
    title,
    body,
    draft: repo.prDraftDefault,
    labels: (repo.prLabels as string[]) ?? [],
    reviewers: (repo.prReviewers as string[]) ?? [],
  };
}

/**
 * Build PR title from template
 */
function buildTitle(task: Task, repo: Repo): string {
  const template = repo.prTitleTemplate ?? "[LoopForge] {{title}}";

  return template
    .replace(/\{\{title\}\}/g, task.title)
    .replace(/\{\{id\}\}/g, task.id.slice(0, 8))
    .replace(/\{\{branch\}\}/g, task.branch ?? "feature");
}

/**
 * Build PR body with all relevant information
 */
function buildBody(options: {
  task: Task;
  execution?: Execution;
  testRun?: TestRun | null;
  filesChanged: string[];
  commitMessages: string[];
}): string {
  const { task, execution, testRun, filesChanged, commitMessages } = options;

  const sections: string[] = [];

  // Summary section
  sections.push("## Summary\n");

  if (task.description) {
    sections.push(task.description + "\n");
  }

  // AI Analysis (from brainstorm result)
  if (task.brainstormResult) {
    sections.push("\n## AI Analysis\n");
    try {
      const brainstorm = JSON.parse(task.brainstormResult);
      if (brainstorm.understanding) {
        sections.push(`**Understanding**: ${brainstorm.understanding}\n`);
      }
      if (brainstorm.approach) {
        sections.push(`**Approach**: ${brainstorm.approach}\n`);
      }
      if (brainstorm.requirements && Array.isArray(brainstorm.requirements)) {
        sections.push("\n**Key Requirements**:\n");
        for (const req of brainstorm.requirements.slice(0, 5)) {
          sections.push(`- ${req}\n`);
        }
      }
    } catch {
      // If not JSON, just include as-is (truncated)
      const truncated = task.brainstormResult.slice(0, 500);
      sections.push(
        truncated + (task.brainstormResult.length > 500 ? "..." : "") + "\n",
      );
    }
  }

  // Implementation Plan (from plan content)
  if (task.planContent) {
    sections.push("\n## Implementation Plan\n");
    try {
      const plan = JSON.parse(task.planContent);
      if (plan.steps && Array.isArray(plan.steps)) {
        for (const step of plan.steps.slice(0, 10)) {
          const status = step.completed ? "[x]" : "[ ]";
          sections.push(
            `- ${status} ${step.description || step.title || step}\n`,
          );
        }
      } else {
        // Plain text plan
        const truncated = task.planContent.slice(0, 1000);
        sections.push(
          truncated + (task.planContent.length > 1000 ? "..." : "") + "\n",
        );
      }
    } catch {
      const truncated = task.planContent.slice(0, 1000);
      sections.push(
        truncated + (task.planContent.length > 1000 ? "..." : "") + "\n",
      );
    }
  }

  // Changes section
  if (filesChanged.length > 0) {
    sections.push("\n## Changes\n");
    sections.push(`**${filesChanged.length} files changed**\n\n`);

    // Group by directory
    const byDir = new Map<string, string[]>();
    for (const file of filesChanged) {
      const parts = file.split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      if (!byDir.has(dir)) {
        byDir.set(dir, []);
      }
      byDir.get(dir)!.push(parts[parts.length - 1]);
    }

    // Show first 20 files
    let shown = 0;
    for (const [dir, files] of byDir) {
      if (shown >= 20) {
        sections.push(`\n... and ${filesChanged.length - shown} more files\n`);
        break;
      }
      sections.push(`\n**${dir}/**\n`);
      for (const file of files) {
        if (shown >= 20) break;
        sections.push(`- ${file}\n`);
        shown++;
      }
    }
  }

  // Commits section
  if (commitMessages.length > 0) {
    sections.push("\n## Commits\n");
    for (const msg of commitMessages.slice(0, 10)) {
      sections.push(`- ${msg}\n`);
    }
    if (commitMessages.length > 10) {
      sections.push(`\n... and ${commitMessages.length - 10} more commits\n`);
    }
  }

  // Test results section
  if (testRun) {
    sections.push("\n## Test Results\n");

    const statusEmoji = {
      passed: ":white_check_mark:",
      failed: ":x:",
      timeout: ":hourglass:",
      running: ":arrows_counterclockwise:",
      skipped: ":fast_forward:",
    };

    const emoji = statusEmoji[testRun.status] || ":question:";
    sections.push(`${emoji} **${testRun.status.toUpperCase()}**\n`);

    if (testRun.durationMs) {
      const duration = formatDuration(testRun.durationMs);
      sections.push(`\n*Duration: ${duration}*\n`);
    }

    if (testRun.status === "failed" && testRun.stderr) {
      sections.push("\n<details>\n<summary>Error Output</summary>\n\n```\n");
      sections.push(testRun.stderr.slice(0, 2000));
      if (testRun.stderr.length > 2000) {
        sections.push("\n... (truncated)");
      }
      sections.push("\n```\n</details>\n");
    }
  }

  // Footer
  sections.push("\n---\n");
  sections.push(
    "*This PR was generated by [LoopForge Studio](https://loopforge.dev)*\n",
  );

  if (execution?.id) {
    sections.push(`\n*Execution ID: \`${execution.id.slice(0, 8)}\`*\n`);
  }

  return sections.join("");
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Generate a branch name from task title
 */
export function generateBranchName(task: Task): string {
  const prefix = "loopforge";
  const id = task.id.slice(0, 8);

  // Sanitize title for branch name
  const sanitized = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `${prefix}/${sanitized}-${id}`;
}

/**
 * Validate that a PR can be created
 */
export function validatePrCreation(
  task: Task,
  repo: Repo,
): {
  valid: boolean;
  reason?: string;
} {
  if (!task.branch) {
    return { valid: false, reason: "Task has no branch" };
  }

  if (task.status !== "done" && task.status !== "review") {
    return {
      valid: false,
      reason: `Task status is ${task.status}, expected done or review`,
    };
  }

  return { valid: true };
}
