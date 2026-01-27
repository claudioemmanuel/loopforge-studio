/**
 * File Writer - Parses agent output and writes file changes to disk
 */

import fs from "fs/promises";
import path from "path";

export interface FileChange {
  path: string;
  action: "create" | "modify" | "delete";
  content: string;
}

export interface ApplyResult {
  writtenFiles: string[];
  errors: Array<{ path: string; error: string }>;
}

/**
 * Parse agent output for code blocks with file paths
 *
 * Supported patterns:
 * 1. Markdown code blocks with file path in language annotation:
 *    ```typescript // path/to/file.ts
 *    ```
 *
 * 2. Markdown code blocks with file path comment on first line:
 *    ```typescript
 *    // File: path/to/file.ts
 *    ```
 *
 * 3. Explicit file markers:
 *    **File: `src/app.ts`**
 *    ```typescript
 *    ```
 *
 * 4. Path in code fence annotation:
 *    ```typescript:path/to/file.ts
 *    ```
 */
export function parseFileChanges(agentOutput: string): FileChange[] {
  const changes: FileChange[] = [];
  const seenPaths = new Set<string>();

  // Pattern 1 & 4: Code blocks with file path in fence line
  // Matches: ```typescript // path/to/file.ts OR ```typescript:path/to/file.ts
  const codeFenceWithPathRegex =
    /```(\w+)?(?:\s*\/\/\s*|\s*:\s*)([\w./-]+\.\w+)\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeFenceWithPathRegex.exec(agentOutput)) !== null) {
    const [, , filePath, content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify", // Assume modify; create if doesn't exist
        content: content.trim(),
      });
    }
  }

  // Pattern 2: Code blocks with file path comment on first line
  // Matches: ```typescript\n// File: path/to/file.ts
  const codeBlockWithFileCommentRegex =
    /```(\w+)?\s*\n\/\/\s*(?:File|file|PATH|path):\s*([\w./-]+\.\w+)\s*\n([\s\S]*?)```/g;

  while ((match = codeBlockWithFileCommentRegex.exec(agentOutput)) !== null) {
    const [, , filePath, content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
      });
    }
  }

  // Pattern 3: Explicit file markers before code blocks
  // Matches: **File: `src/app.ts`** followed by ```
  const explicitFileMarkerRegex =
    /\*\*(?:File|file|PATH|path):\s*`?([\w./-]+\.\w+)`?\*\*\s*\n+```(\w+)?\s*\n([\s\S]*?)```/g;

  while ((match = explicitFileMarkerRegex.exec(agentOutput)) !== null) {
    const [, filePath, , content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
      });
    }
  }

  // Pattern for DELETE markers
  const deleteMarkerRegex =
    /\*\*(?:DELETE|delete|Remove|remove):\s*`?([\w./-]+\.\w+)`?\*\*/g;

  while ((match = deleteMarkerRegex.exec(agentOutput)) !== null) {
    const [, filePath] = match;
    if (filePath && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "delete",
        content: "",
      });
    }
  }

  return changes;
}

/**
 * Apply file changes to disk in the working directory
 */
export async function applyFileChanges(
  workingDir: string,
  changes: FileChange[],
): Promise<ApplyResult> {
  const writtenFiles: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const change of changes) {
    const fullPath = path.join(workingDir, change.path);

    try {
      if (change.action === "delete") {
        // Check if file exists before deleting
        try {
          await fs.access(fullPath);
          await fs.unlink(fullPath);
          writtenFiles.push(change.path);
        } catch {
          // File doesn't exist, skip
        }
      } else {
        // Create or modify: ensure parent directory exists
        const dirPath = path.dirname(fullPath);
        await fs.mkdir(dirPath, { recursive: true });

        // Write the file
        await fs.writeFile(fullPath, change.content, "utf-8");
        writtenFiles.push(change.path);
      }
    } catch (err) {
      errors.push({
        path: change.path,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { writtenFiles, errors };
}

/**
 * Check if any file changes were detected in agent output
 */
export function hasFileChanges(agentOutput: string): boolean {
  const changes = parseFileChanges(agentOutput);
  return changes.length > 0;
}
