import type { AIClient } from "./client";
import { extractJSON } from "./json-extractor";
import { aiLogger } from "@/lib/logger";

export interface BrainstormResult {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

export async function brainstormTask(
  client: AIClient,
  title: string,
  description: string | null,
): Promise<BrainstormResult> {
  const prompt = `You are a senior software engineer helping to brainstorm a coding task.

## Task
Title: ${title}
${description ? `Description: ${description}` : ""}

## Instructions
Analyze this task and provide:
1. A brief summary of what needs to be done
2. Key requirements and acceptance criteria
3. Technical considerations and potential challenges
4. A suggested approach or implementation strategy

Format your response as JSON with this structure:
{
  "summary": "Brief summary of the task",
  "requirements": ["requirement 1", "requirement 2", ...],
  "considerations": ["consideration 1", "consideration 2", ...],
  "suggestedApproach": "Description of the recommended approach"
}

Respond only with valid JSON, no additional text.`;

  const text = await client.chat([{ role: "user", content: prompt }], {
    maxTokens: 2048,
  });

  // Log response info for debugging
  aiLogger.debug(
    {
      responseLength: text.length,
      startsWithCodeBlock: text.trim().startsWith("```"),
      endsWithCodeBlock: text.trim().endsWith("```"),
      firstChars: text.substring(0, 50),
      lastChars: text.substring(Math.max(0, text.length - 50)),
    },
    "AI brainstorm response received",
  );

  // Use robust JSON extraction that handles multiple formats
  const parsed = extractJSON(text);

  if (parsed && typeof parsed === "object") {
    // Validate and return with defaults for missing fields
    const data = parsed as Record<string, unknown>;
    return {
      summary:
        typeof data.summary === "string"
          ? data.summary
          : `Analysis of: ${title}`,
      requirements: Array.isArray(data.requirements) ? data.requirements : [],
      considerations: Array.isArray(data.considerations)
        ? data.considerations
        : [],
      suggestedApproach:
        typeof data.suggestedApproach === "string"
          ? data.suggestedApproach
          : "Further analysis needed",
    };
  }

  // If JSON parsing fails completely, try to extract useful content from the text
  const cleanedText = text.trim();

  // Check if it looks like the AI tried to respond but JSON was malformed
  if (cleanedText.includes("{") || cleanedText.includes("summary")) {
    aiLogger.error(
      { responsePreview: cleanedText.substring(0, 200) },
      "Failed to parse AI response as JSON",
    );
    return {
      summary: "The AI response could not be parsed. Please try again.",
      requirements: [],
      considerations: [],
      suggestedApproach:
        "Retry the brainstorming step or try with a different AI model.",
    };
  }

  // AI responded with plain text instead of JSON
  return {
    summary: cleanedText.substring(0, 500),
    requirements: [],
    considerations: [],
    suggestedApproach: cleanedText,
  };
}
