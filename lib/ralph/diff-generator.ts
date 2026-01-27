/**
 * Diff Generator - Generates unified diffs for file changes
 * Used for diff preview in the review flow
 */

import { createTwoFilesPatch, structuredPatch } from "diff";

export interface FileChange {
  filePath: string;
  action: "create" | "modify" | "delete";
  oldContent: string | null;
  newContent: string;
}

export interface DiffResult {
  filePath: string;
  action: "create" | "modify" | "delete";
  patch: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "addition" | "deletion";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Generate a unified diff for a single file change
 */
export function generateDiff(change: FileChange): DiffResult {
  const oldContent = change.oldContent ?? "";
  const newContent = change.newContent;

  // Generate unified diff patch
  const patch = createTwoFilesPatch(
    `a/${change.filePath}`,
    `b/${change.filePath}`,
    oldContent,
    newContent,
    "", // old header
    "", // new header
    { context: 3 },
  );

  // Parse the patch to get structured info
  const parsed = structuredPatch(
    `a/${change.filePath}`,
    `b/${change.filePath}`,
    oldContent,
    newContent,
    "",
    "",
    { context: 3 },
  );

  // Count additions and deletions
  let additions = 0;
  let deletions = 0;
  const hunks: DiffHunk[] = [];

  for (const hunk of parsed.hunks) {
    const diffHunk: DiffHunk = {
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines: [],
    };

    let oldLineNum = hunk.oldStart;
    let newLineNum = hunk.newStart;

    for (const line of hunk.lines) {
      if (line.startsWith("+")) {
        additions++;
        diffHunk.lines.push({
          type: "addition",
          content: line.slice(1),
          newLineNumber: newLineNum++,
        });
      } else if (line.startsWith("-")) {
        deletions++;
        diffHunk.lines.push({
          type: "deletion",
          content: line.slice(1),
          oldLineNumber: oldLineNum++,
        });
      } else {
        diffHunk.lines.push({
          type: "context",
          content: line.startsWith(" ") ? line.slice(1) : line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    }

    hunks.push(diffHunk);
  }

  return {
    filePath: change.filePath,
    action: change.action,
    patch,
    additions,
    deletions,
    hunks,
  };
}

/**
 * Generate diffs for multiple file changes
 */
export function generateDiffs(changes: FileChange[]): DiffResult[] {
  return changes.map(generateDiff);
}

/**
 * Calculate summary statistics for a set of diffs
 */
export function getDiffSummary(diffs: DiffResult[]): {
  totalFiles: number;
  additions: number;
  deletions: number;
  created: number;
  modified: number;
  deleted: number;
} {
  let additions = 0;
  let deletions = 0;
  let created = 0;
  let modified = 0;
  let deleted = 0;

  for (const diff of diffs) {
    additions += diff.additions;
    deletions += diff.deletions;

    switch (diff.action) {
      case "create":
        created++;
        break;
      case "modify":
        modified++;
        break;
      case "delete":
        deleted++;
        break;
    }
  }

  return {
    totalFiles: diffs.length,
    additions,
    deletions,
    created,
    modified,
    deleted,
  };
}

/**
 * Format a diff result as a string for display
 */
export function formatDiffForDisplay(diff: DiffResult): string {
  const header = `diff --git a/${diff.filePath} b/${diff.filePath}`;
  const actionLine =
    diff.action === "create"
      ? "new file"
      : diff.action === "delete"
        ? "deleted file"
        : "modified";

  return `${header}\n${actionLine}\n${diff.patch}`;
}

/**
 * Detect the action type based on old and new content
 */
export function detectAction(
  oldContent: string | null | undefined,
  newContent: string | null | undefined,
): "create" | "modify" | "delete" {
  if (!oldContent && newContent) {
    return "create";
  }
  if (oldContent && !newContent) {
    return "delete";
  }
  return "modify";
}
