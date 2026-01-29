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

export type ExtractionStrategy =
  | "strict"
  | "fuzzy"
  | "ai-json"
  | "ai-single-file"
  | "ai-code-mapping"
  | "ai-assisted"
  | "none";

export interface ExtractionResult {
  files: FileChange[];
  method: ExtractionStrategy;
  confidence: number; // 0-1
  warnings: string[];
  shouldRetry: boolean;
  recommendedStrategy?: ExtractionStrategy;
}

export interface ExtractionOptions {
  client?: AIClient;
  strategy?: ExtractionStrategy;
  previousAttempts?: number;
  focusFiles?: string[];
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
 * Strategy 1: AI-JSON - Structured JSON format with file metadata
 */
async function aiJsonExtraction(
  output: string,
  client: AIClient,
): Promise<FileChange[]> {
  const prompt = `Extract file changes from this AI agent output and return as structured JSON.

For each file change, provide:
- path: relative file path (e.g., "src/components/Header.tsx")
- action: "create", "modify", or "delete"
- content: complete file content (empty string for delete)

Return ONLY valid JSON array with this exact structure:
[
  {
    "path": "path/to/file.ts",
    "action": "modify",
    "content": "// Complete file content here"
  }
]

Agent output:
---
${output.slice(0, 15000)}
---

JSON array:`;

  try {
    const response = await client.chat([{ role: "user", content: prompt }], {
      maxTokens: 8192,
    });

    // Extract JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item.path && typeof item.path === "string")
      .map((item) => ({
        path: item.path,
        action: (item.action as "create" | "modify" | "delete") || "modify",
        content: String(item.content || "").trim(),
        confidence: "medium" as const,
      }));
  } catch (error) {
    console.error("AI-JSON extraction failed:", error);
    return [];
  }
}

/**
 * Strategy 2: AI-Single-File - One file at a time
 */
async function aiSingleFileExtraction(
  output: string,
  client: AIClient,
  focusFiles?: string[],
): Promise<FileChange[]> {
  const focusFile = focusFiles?.[0] || "the most critical file";

  const prompt = `Extract ONLY the file content for: ${focusFile}

From this AI agent output, find and return the complete content for this specific file.
Ignore all other files.

Return the content in this exact format:
\`\`\`
FILE: ${focusFile}
\`\`\`
<complete file content>
\`\`\`

Agent output:
---
${output.slice(0, 15000)}
---

File content:`;

  try {
    const response = await client.chat([{ role: "user", content: prompt }], {
      maxTokens: 8192,
    });

    // Extract file content from response
    const fileMatch = response.match(
      /```[\s\S]*?FILE:\s*(.+?)\s*```\s*([\s\S]*?)```/,
    );
    if (!fileMatch) {
      // Fallback: try to extract just the code block
      const codeMatch = response.match(/```(?:\w+)?\s*\n([\s\S]*?)```/);
      if (codeMatch) {
        return [
          {
            path: focusFile,
            action: "modify",
            content: codeMatch[1].trim(),
            confidence: "medium",
          },
        ];
      }
      return [];
    }

    const [, extractedPath, content] = fileMatch;
    return [
      {
        path: extractedPath.trim(),
        action: "modify",
        content: content.trim(),
        confidence: "high",
      },
    ];
  } catch (error) {
    console.error("AI-single-file extraction failed:", error);
    return [];
  }
}

/**
 * Strategy 3: AI-Code-Mapping - AI suggests paths + line ranges, system applies
 */
async function aiCodeMappingExtraction(
  output: string,
  client: AIClient,
): Promise<FileChange[]> {
  const prompt = `Analyze this AI agent output and create a change map.

For each file that needs modification, provide:
1. File path
2. Description of what changed
3. Key sections that need updating

Return JSON array:
[
  {
    "path": "src/file.ts",
    "description": "Add new function to handle X",
    "sections": ["function imports", "main handler"]
  }
]

Agent output:
---
${output.slice(0, 15000)}
---

Change map:`;

  try {
    const response = await client.chat([{ role: "user", content: prompt }], {
      maxTokens: 4096,
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // For now, just return file paths with markers
    // In future, could integrate with AST-based diff application
    return parsed
      .filter((item) => item.path)
      .map((item) => ({
        path: item.path,
        action: "modify" as const,
        content: `// File needs update: ${item.description}\n// Sections: ${item.sections?.join(", ") || "N/A"}`,
        confidence: "low" as const,
      }));
  } catch (error) {
    console.error("AI-code-mapping extraction failed:", error);
    return [];
  }
}

/**
 * AI-assisted extraction (legacy) - low confidence but catches unstructured output
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
 * Calculates confidence score based on extraction method and results
 */
function calculateConfidence(
  method: ExtractionStrategy,
  files: FileChange[],
): number {
  if (files.length === 0) return 0;

  const baseConfidence = {
    strict: 0.95,
    fuzzy: 0.75,
    "ai-json": 0.7,
    "ai-single-file": 0.8,
    "ai-code-mapping": 0.5,
    "ai-assisted": 0.6,
    none: 0,
  }[method];

  // Adjust based on file confidence
  const avgFileConfidence =
    files.reduce((sum, f) => {
      const conf =
        f.confidence === "high" ? 1 : f.confidence === "medium" ? 0.7 : 0.4;
      return sum + conf;
    }, 0) / files.length;

  return baseConfidence * 0.7 + avgFileConfidence * 0.3;
}

/**
 * Determines if extraction should be retried and suggests next strategy
 */
function shouldRetryExtraction(
  method: ExtractionStrategy,
  files: FileChange[],
  previousAttempts: number,
): { shouldRetry: boolean; recommendedStrategy?: ExtractionStrategy } {
  // Max 3 attempts
  if (previousAttempts >= 3) {
    return { shouldRetry: false };
  }

  // No files found → try next strategy
  if (files.length === 0) {
    const nextStrategy: Record<
      ExtractionStrategy,
      ExtractionStrategy | undefined
    > = {
      strict: "fuzzy",
      fuzzy: "ai-json",
      "ai-json": "ai-single-file",
      "ai-single-file": "ai-assisted",
      "ai-code-mapping": "ai-assisted",
      "ai-assisted": undefined,
      none: "ai-json",
    };

    const recommended = nextStrategy[method];
    return {
      shouldRetry: !!recommended,
      recommendedStrategy: recommended,
    };
  }

  // Low confidence → suggest better strategy
  const confidence = calculateConfidence(method, files);
  if (confidence < 0.6) {
    if (method === "fuzzy" || method === "ai-assisted") {
      return {
        shouldRetry: true,
        recommendedStrategy: "ai-single-file",
      };
    }
  }

  return { shouldRetry: false };
}

/**
 * Main smart extraction function with progressive strategies
 * Supports multiple extraction strategies with confidence scoring
 */
export async function smartExtractFiles(
  output: string,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const { client, strategy, previousAttempts = 0, focusFiles } = options;
  const warnings: string[] = [];

  let files: FileChange[] = [];
  let method: ExtractionStrategy = "none";

  // Use specified strategy if provided
  if (strategy && client) {
    switch (strategy) {
      case "ai-json":
        files = await aiJsonExtraction(output, client);
        method = "ai-json";
        warnings.push("Using structured JSON extraction strategy");
        break;
      case "ai-single-file":
        files = await aiSingleFileExtraction(output, client, focusFiles);
        method = "ai-single-file";
        warnings.push("Using single-file focus strategy");
        break;
      case "ai-code-mapping":
        files = await aiCodeMappingExtraction(output, client);
        method = "ai-code-mapping";
        warnings.push("Using code mapping strategy (experimental)");
        break;
      case "ai-assisted":
        files = await aiAssistedExtraction(output, client);
        method = "ai-assisted";
        warnings.push("Using AI-assisted extraction");
        break;
      default:
        // Fall through to default progressive logic
        break;
    }

    // When strategy is explicitly specified, return the result even if no files found
    // This ensures the method reflects what was actually attempted
    if (method !== "none") {
      const confidence = calculateConfidence(method, files);
      const retry = shouldRetryExtraction(method, files, previousAttempts);

      return {
        files,
        method,
        confidence,
        warnings,
        shouldRetry: retry.shouldRetry,
        recommendedStrategy: retry.recommendedStrategy,
      };
    }
  }

  // Default progressive strategy: try strict → fuzzy → AI methods

  // Try strict patterns first
  const strictChanges = parseStrictPatterns(output);
  if (strictChanges.length > 0) {
    const confidence = calculateConfidence("strict", strictChanges);
    return {
      files: strictChanges,
      method: "strict",
      confidence,
      warnings,
      shouldRetry: false,
    };
  }

  // Try fuzzy patterns
  const fuzzyChanges = parseFuzzyPatterns(output);
  if (fuzzyChanges.length > 0) {
    warnings.push(
      "Used fuzzy pattern matching - verify file paths are correct",
    );
    const confidence = calculateConfidence("fuzzy", fuzzyChanges);
    const retry = shouldRetryExtraction(
      "fuzzy",
      fuzzyChanges,
      previousAttempts,
    );

    return {
      files: fuzzyChanges,
      method: "fuzzy",
      confidence,
      warnings,
      shouldRetry: retry.shouldRetry,
      recommendedStrategy: retry.recommendedStrategy,
    };
  }

  // Try AI-assisted extraction if client provided
  if (client) {
    // Try JSON first (most structured)
    const jsonChanges = await aiJsonExtraction(output, client);
    if (jsonChanges.length > 0) {
      warnings.push("Using AI JSON extraction");
      const confidence = calculateConfidence("ai-json", jsonChanges);
      return {
        files: jsonChanges,
        method: "ai-json",
        confidence,
        warnings,
        shouldRetry: false,
      };
    }

    // Try single-file strategy if focus files specified
    if (focusFiles && focusFiles.length > 0) {
      const singleFileChanges = await aiSingleFileExtraction(
        output,
        client,
        focusFiles,
      );
      if (singleFileChanges.length > 0) {
        warnings.push("Using single-file extraction strategy");
        const confidence = calculateConfidence(
          "ai-single-file",
          singleFileChanges,
        );
        return {
          files: singleFileChanges,
          method: "ai-single-file",
          confidence,
          warnings,
          shouldRetry: false,
        };
      }
    }

    // Fallback to legacy AI-assisted
    warnings.push(
      "Using AI-assisted extraction - results may need manual verification",
    );
    const aiChanges = await aiAssistedExtraction(output, client);
    if (aiChanges.length > 0) {
      const confidence = calculateConfidence("ai-assisted", aiChanges);
      const retry = shouldRetryExtraction(
        "ai-assisted",
        aiChanges,
        previousAttempts,
      );

      return {
        files: aiChanges,
        method: "ai-assisted",
        confidence,
        warnings,
        shouldRetry: retry.shouldRetry,
        recommendedStrategy: retry.recommendedStrategy,
      };
    }
  }

  // No files found
  warnings.push("No file changes could be extracted from agent output");
  const retry = shouldRetryExtraction("none", [], previousAttempts);

  return {
    files: [],
    method: "none",
    confidence: 0,
    warnings,
    shouldRetry: retry.shouldRetry,
    recommendedStrategy: retry.recommendedStrategy,
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
