/**
 * Robust JSON extraction that handles various AI response formats.
 * Tries multiple strategies to extract valid JSON from a response.
 */
export function extractJSON(response: string): object | null {
  const trimmed = response.trim();

  // Try 1: Direct parse (response is already valid JSON)
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // Not valid JSON, continue to next strategy
  }

  // Try 2: Strip markdown code blocks (```json ... ```)
  const jsonCodeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonCodeBlockMatch) {
    try {
      const parsed = JSON.parse(jsonCodeBlockMatch[1].trim());
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch {
      // Invalid JSON inside code block, continue
    }
  }

  // Try 2b: Handle markdown code block without closing ``` (common with Gemini)
  const openCodeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]+)/);
  if (openCodeBlockMatch && !jsonCodeBlockMatch) {
    const content = openCodeBlockMatch[1].trim();
    // Find the JSON object within the code block content
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonStr = content.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed;
        }
      } catch {
        // Try to repair truncated JSON
        const repaired = repairTruncatedJSON(content.slice(firstBrace));
        if (repaired) {
          try {
            const parsed = JSON.parse(repaired);
            if (typeof parsed === "object" && parsed !== null) {
              return parsed;
            }
          } catch {
            // Repair failed, continue
          }
        }
      }
    }
  }

  // Try 3: Find JSON object in text (first { to last })
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = trimmed.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch {
      // Try to repair truncated JSON
      const repaired = repairTruncatedJSON(trimmed.slice(firstBrace));
      if (repaired) {
        try {
          const parsed = JSON.parse(repaired);
          if (typeof parsed === "object" && parsed !== null) {
            return parsed;
          }
        } catch {
          // Repair failed, continue
        }
      }
    }
  }

  // Try 4: Find JSON array in text (first [ to last ])
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const jsonStr = trimmed.slice(firstBracket, lastBracket + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not valid JSON array, continue
    }
  }

  // All strategies failed
  return null;
}

/**
 * Attempts to repair truncated JSON by closing unclosed brackets/braces.
 * This handles cases where AI responses are cut off due to token limits.
 */
export function repairTruncatedJSON(json: string): string | null {
  // Remove trailing incomplete string values (cut off mid-string)
  let repaired = json.replace(/,?\s*"[^"]*$/, "");

  // Remove trailing incomplete array elements
  repaired = repaired.replace(/,\s*$/, "");

  // Count open/close braces and brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of repaired) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (char === "[") bracketCount++;
    if (char === "]") bracketCount--;
  }

  // If we're still in a string, try to close it
  if (inString) {
    repaired += '"';
  }

  // Close any unclosed brackets and braces
  while (bracketCount > 0) {
    repaired += "]";
    bracketCount--;
  }
  while (braceCount > 0) {
    repaired += "}";
    braceCount--;
  }

  // Only return if we made changes
  if (repaired !== json) {
    return repaired;
  }

  return null;
}
