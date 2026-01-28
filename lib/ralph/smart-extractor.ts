/**
 * Smart File Extractor - Enhanced file extraction with fuzzy matching and AI fallback
 *
 * Tries multiple strategies to extract file changes from AI agent output:
 * 1. Strict patterns (existing parseFileChanges)
 * 2. Fuzzy patterns (common variations)
 * 3. AI-assisted extraction (last resort)
 */

import type { AIClient } from "@/lib/ai/client";

export interface FileChange {
  path: string;
  action: "create" | "modify" | "delete";
  content: string;
  confidence: "high" | "medium" | "low";
}

export interface ExtractionResult {
  files: FileChange[];
  method: "strict" | "fuzzy" | "ai-assisted" | "none";
  warnings: string[];
}

/**
 * Strict patterns - high confidence extraction
 * These match well-formatted code blocks with explicit file paths
 */
function parseStrictPatterns(output: string): FileChange[] {
  const changes: FileChange[] = [];
  const seenPaths = new Set<string>();

  // Pattern 1 & 4: Code blocks with file path in fence line
  // Matches: ```typescript // path/to/file.ts OR ```typescript:path/to/file.ts
  const codeFenceWithPathRegex =
    /```(\w+)?(?:\s*\/\/\s*|\s*:\s*)([\w./-]+\.\w+)\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeFenceWithPathRegex.exec(output)) !== null) {
    const [, , filePath, content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "high",
      });
    }
  }

  // Pattern 2: Code blocks with file path comment on first line
  // Matches: ```typescript\n// File: path/to/file.ts
  const codeBlockWithFileCommentRegex =
    /```(\w+)?\s*\n\/\/\s*(?:File|file|PATH|path):\s*([\w./-]+\.\w+)\s*\n([\s\S]*?)```/g;

  while ((match = codeBlockWithFileCommentRegex.exec(output)) !== null) {
    const [, , filePath, content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "high",
      });
    }
  }

  // Pattern 3: Explicit file markers before code blocks
  // Matches: **File: `src/app.ts`** followed by ```
  const explicitFileMarkerRegex =
    /\*\*(?:File|file|PATH|path):\s*`?([\w./-]+\.\w+)`?\*\*\s*\n+```(\w+)?\s*\n([\s\S]*?)```/g;

  while ((match = explicitFileMarkerRegex.exec(output)) !== null) {
    const [, filePath, , content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "high",
      });
    }
  }

  // Pattern for DELETE markers
  const deleteMarkerRegex =
    /\*\*(?:DELETE|delete|Remove|remove):\s*`?([\w./-]+\.\w+)`?\*\*/g;

  while ((match = deleteMarkerRegex.exec(output)) !== null) {
    const [, filePath] = match;
    if (filePath && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "delete",
        content: "",
        confidence: "high",
      });
    }
  }

  return changes;
}

/**
 * Fuzzy patterns - medium confidence extraction
 * These match common but less structured formats
 */
function parseFuzzyPatterns(output: string): FileChange[] {
  const changes: FileChange[] = [];
  const seenPaths = new Set<string>();

  // Pattern: "Create file X:" or "Modify file X:" followed by code block
  const createModifyPattern =
    /(?:create|modify|update|edit|write(?:\s+to)?)\s+(?:file\s+)?[`"']?([\w./-]+\.\w+)[`"']?\s*:?\s*\n+```(\w+)?\s*\n([\s\S]*?)```/gi;
  let match;

  while ((match = createModifyPattern.exec(output)) !== null) {
    const [, filePath, , content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "medium",
      });
    }
  }

  // Pattern: File path in header (## src/file.ts or ### `src/file.ts`)
  const headerFilePattern =
    /#{2,4}\s+[`"']?([\w./-]+\.\w+)[`"']?\s*\n+```(\w+)?\s*\n([\s\S]*?)```/g;

  while ((match = headerFilePattern.exec(output)) !== null) {
    const [, filePath, , content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "medium",
      });
    }
  }

  // Pattern: Inline path mention before code block (within 2 lines)
  // e.g., "Here's the updated `src/app.ts`:\n\n```"
  const inlinePathPattern =
    /[`"']([\w./-]+\.\w+)[`"']\s*:?\s*\n{1,3}```(\w+)?\s*\n([\s\S]*?)```/g;

  while ((match = inlinePathPattern.exec(output)) !== null) {
    const [, filePath, , content] = match;
    // Filter out common false positives
    if (
      filePath &&
      content &&
      !seenPaths.has(filePath) &&
      !filePath.startsWith("http") &&
      !filePath.includes("example") &&
      content.length > 20
    ) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "medium",
      });
    }
  }

  // Pattern: Code block with file path in first line comment (any language)
  // e.g., ```\n# path/to/file.py\n...``` or ```\n/* path/to/file.css */\n...```
  const firstLineCommentPattern =
    /```(\w+)?\s*\n(?:\/\/|#|\/\*|\{\/\*)\s*([\w./-]+\.\w+)\s*(?:\*\/|\*\/\})?\s*\n([\s\S]*?)```/g;

  while ((match = firstLineCommentPattern.exec(output)) !== null) {
    const [, , filePath, content] = match;
    if (filePath && content && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      changes.push({
        path: filePath,
        action: "modify",
        content: content.trim(),
        confidence: "medium",
      });
    }
  }

  return changes;
}

/**
 * AI-assisted extraction - low confidence but catches unstructured output
 */
async function aiAssistedExtraction(
  output: string,
  client: AIClient,
): Promise<FileChange[]> {
  const prompt = `Analyze the following AI agent output and extract any file changes that should be written to disk.

For each file change, identify:
1. The file path (relative path like src/app.ts)
2. The action (create, modify, or delete)
3. The complete file content

Return your response as a JSON array with objects containing: path, action, content

If no clear file changes can be identified, return an empty array [].

IMPORTANT: Only extract actual code/content that should be written to files. Do not include explanatory text, markdown, or partial code snippets.

Agent output to analyze:
---
${output.slice(0, 15000)}
---

Respond ONLY with valid JSON array, no markdown formatting:`;

  try {
    const response = await client.chat([{ role: "user", content: prompt }], {
      maxTokens: 8192,
    });

    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item: { path?: string; content?: string; action?: string }) =>
          item.path &&
          typeof item.path === "string" &&
          item.content !== undefined,
      )
      .map((item: { path: string; content: string; action?: string }) => ({
        path: item.path,
        action: (item.action as "create" | "modify" | "delete") || "modify",
        content: String(item.content || "").trim(),
        confidence: "low" as const,
      }));
  } catch (error) {
    console.error("AI-assisted extraction failed:", error);
    return [];
  }
}

/**
 * Main smart extraction function
 * Tries strict patterns first, then fuzzy, then AI-assisted
 */
export async function smartExtractFiles(
  output: string,
  client?: AIClient,
): Promise<ExtractionResult> {
  const warnings: string[] = [];

  // Try strict patterns first
  const strictChanges = parseStrictPatterns(output);
  if (strictChanges.length > 0) {
    return {
      files: strictChanges,
      method: "strict",
      warnings,
    };
  }

  // Try fuzzy patterns
  const fuzzyChanges = parseFuzzyPatterns(output);
  if (fuzzyChanges.length > 0) {
    warnings.push(
      "Used fuzzy pattern matching - verify file paths are correct",
    );
    return {
      files: fuzzyChanges,
      method: "fuzzy",
      warnings,
    };
  }

  // Try AI-assisted extraction if client provided
  if (client) {
    warnings.push(
      "Using AI-assisted extraction - results may need manual verification",
    );
    const aiChanges = await aiAssistedExtraction(output, client);
    if (aiChanges.length > 0) {
      return {
        files: aiChanges,
        method: "ai-assisted",
        warnings,
      };
    }
  }

  // No files found
  warnings.push("No file changes could be extracted from agent output");
  return {
    files: [],
    method: "none",
    warnings,
  };
}

/**
 * Check if output contains any extractable file changes
 */
export function hasExtractableFiles(output: string): boolean {
  const strict = parseStrictPatterns(output);
  if (strict.length > 0) return true;

  const fuzzy = parseFuzzyPatterns(output);
  return fuzzy.length > 0;
}

/**
 * Get format instructions for retry prompts
 */
export function getFormatInstructions(): string {
  return `
IMPORTANT: When outputting code changes, use one of these formats:

1. Code fence with path annotation:
\`\`\`typescript // src/path/to/file.ts
// your code here
\`\`\`

2. File marker before code block:
**File: \`src/path/to/file.ts\`**
\`\`\`typescript
// your code here
\`\`\`

3. Code fence with path in first line comment:
\`\`\`typescript
// File: src/path/to/file.ts
// your code here
\`\`\`

For file deletions, use:
**DELETE: \`src/path/to/delete.ts\`**

Always include the complete file content, not just snippets or diffs.
`;
}
