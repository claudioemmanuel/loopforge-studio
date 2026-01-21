import type { AIClient } from "./client";

export interface BrainstormResult {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

export async function brainstormTask(
  client: AIClient,
  title: string,
  description: string | null
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

  const text = await client.chat(
    [{ role: "user", content: prompt }],
    { maxTokens: 2048 }
  );

  // Strip markdown code blocks if present (common with Gemini)
  let cleanedText = text.trim();

  // Handle ```json with optional newlines/whitespace
  const jsonBlockMatch = cleanedText.match(/^```json\s*([\s\S]*?)\s*```$/);
  const codeBlockMatch = cleanedText.match(/^```\s*([\s\S]*?)\s*```$/);

  if (jsonBlockMatch) {
    cleanedText = jsonBlockMatch[1].trim();
  } else if (codeBlockMatch) {
    cleanedText = codeBlockMatch[1].trim();
  } else {
    // Fallback: simple strip
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();
  }

  try {
    return JSON.parse(cleanedText);
  } catch {
    // If JSON parsing fails, create a structured response from the text
    // Don't include the raw JSON-looking text, just provide a summary
    const summaryText = cleanedText.startsWith("{")
      ? "Failed to parse AI response. Please try again."
      : cleanedText.substring(0, 500);
    return {
      summary: summaryText,
      requirements: [],
      considerations: [],
      suggestedApproach: cleanedText.startsWith("{")
        ? "The AI response was not properly formatted. Please retry the brainstorming step."
        : cleanedText,
    };
  }
}
