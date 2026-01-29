import React from "react";

/**
 * Strip markdown code-block fences from a string.
 *
 * Handles both ` ```json ... ``` ` and plain ` ``` ... ``` ` wrappers that AI
 * providers sometimes include around JSON responses.
 */
export function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim();
  // Remove opening code fence with optional language
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  // Remove closing code fence
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Parsed brainstorm result returned by the AI brainstorming phase.
 */
export interface BrainstormResult {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

/**
 * Attempt to parse a brainstorm result string (possibly wrapped in markdown
 * code blocks) into a structured {@link BrainstormResult}.
 *
 * Returns `null` when the input is falsy or cannot be parsed.
 */
export function parseBrainstormResult(
  result: string | null,
): BrainstormResult | null {
  if (!result) return null;
  try {
    // First try parsing as-is
    const parsed = JSON.parse(result);
    // If suggestedApproach looks like raw JSON, try to extract actual value
    if (
      parsed.suggestedApproach?.startsWith("```") ||
      parsed.suggestedApproach?.startsWith("{")
    ) {
      const stripped = stripMarkdownCodeBlocks(parsed.suggestedApproach);
      try {
        const nested = JSON.parse(stripped);
        // Use fields from nested if they exist
        return {
          summary: nested.summary || parsed.summary,
          requirements: nested.requirements?.length
            ? nested.requirements
            : parsed.requirements,
          considerations: nested.considerations?.length
            ? nested.considerations
            : parsed.considerations,
          suggestedApproach:
            nested.suggestedApproach || parsed.suggestedApproach,
        };
      } catch {
        // Keep original parsed if nested parsing fails
      }
    }
    return parsed;
  } catch {
    // Try stripping markdown first, then parse
    try {
      const stripped = stripMarkdownCodeBlocks(result);
      return JSON.parse(stripped);
    } catch {
      // If still fails, return null to show raw text
      return null;
    }
  }
}

/**
 * Simple markdown-like inline text renderer.
 *
 * Converts `**bold**` patterns into `<strong>` elements; leaves the rest as
 * plain text.  Used in brainstorm result displays.
 */
export function renderFormattedText(text: string): React.ReactNode {
  // Split by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return React.createElement("strong", { key: i }, part.slice(2, -2));
    }
    return part;
  });
}
