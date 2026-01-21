import type { AIClient } from "./client";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  files?: string[];
  estimatedEffort: "small" | "medium" | "large";
  priority: "critical" | "high" | "medium" | "low";
  dependencies?: string[];
}

export interface PlanResult {
  sprintGoal: string;
  overview: string;
  steps: PlanStep[];
  definitionOfDone: string[];
  risks: Array<{
    description: string;
    mitigation: string;
  }>;
  verification: string[];
}

export async function generatePlan(
  client: AIClient,
  title: string,
  description: string | null,
  brainstormResult: string | null
): Promise<PlanResult> {
  const prompt = `You are an expert Scrum Master and senior software engineer facilitating Sprint Planning.

## TASK TO PLAN
Title: ${title}
${description ? `Description: ${description}` : ""}
${brainstormResult ? `\n## REFINED BACKLOG ITEM (from brainstorming)\n${brainstormResult}` : ""}

## SCRUM SPRINT PLANNING FRAMEWORK

Create a comprehensive Sprint Plan using these Scrum principles:

1. **SPRINT GOAL** - One clear, measurable objective this work achieves
2. **TASK BREAKDOWN** - Decompose into small, atomic tasks (each completable in 1-2 hours)
3. **ACCEPTANCE CRITERIA** - Each task must have testable "done" conditions
4. **EFFORT ESTIMATION** - Tag each task: small (< 1hr), medium (1-2hr), large (2-4hr)
5. **PRIORITY** - Mark tasks: critical (must have), high, medium, low (nice to have)
6. **DEPENDENCIES** - Identify which tasks must complete before others
7. **RISKS** - Surface potential blockers with mitigation strategies
8. **DEFINITION OF DONE** - Overall completion criteria for the entire task

## OUTPUT FORMAT (JSON only)
{
  "sprintGoal": "Clear, measurable goal for this work",
  "overview": "High-level approach and architecture decisions",
  "steps": [
    {
      "id": "1",
      "title": "Concise task title",
      "description": "What to implement and how",
      "acceptanceCriteria": ["Testable condition 1", "Testable condition 2"],
      "files": ["path/to/file.ts"],
      "estimatedEffort": "small|medium|large",
      "priority": "critical|high|medium|low",
      "dependencies": ["id of prerequisite task if any"]
    }
  ],
  "definitionOfDone": [
    "All acceptance criteria met",
    "Tests passing",
    "Code reviewed",
    "etc."
  ],
  "risks": [
    {
      "description": "Potential risk or blocker",
      "mitigation": "How to address or prevent it"
    }
  ],
  "verification": ["Step to verify the work is complete", "Another verification step"]
}

## GUIDELINES
- Break work into 4-8 focused tasks (not too granular, not too broad)
- Each task should be independently testable
- Put critical/foundational tasks first
- Include at least 2 acceptance criteria per task
- Identify at least 1-2 risks with mitigations
- Definition of Done should be comprehensive (tests, docs, review, etc.)

Respond ONLY with valid JSON, no markdown or additional text.`;

  const text = await client.chat(
    [{ role: "user", content: prompt }],
    { maxTokens: 4096 }
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
    // Try to extract JSON from mixed content (e.g., text before/after JSON)
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to fallback
      }
    }

    // If JSON parsing fails, create a structured response from the text
    const overviewText = cleanedText.startsWith("{")
      ? "Failed to parse AI response. Please try again."
      : cleanedText.substring(0, 500);
    return {
      sprintGoal: "Complete the requested task",
      overview: overviewText,
      steps: [
        {
          id: "1",
          title: "Implement the task",
          description: cleanedText.startsWith("{")
            ? "The AI response was not properly formatted. Please retry the planning step."
            : cleanedText,
          acceptanceCriteria: ["Task is implemented as specified"],
          estimatedEffort: "medium" as const,
          priority: "high" as const,
        },
      ],
      definitionOfDone: [
        "All acceptance criteria met",
        "Code compiles without errors",
        "Basic testing completed",
      ],
      risks: [
        {
          description: "AI response parsing failed",
          mitigation: "Retry the planning step or manually define the plan",
        },
      ],
      verification: ["Verify the implementation works"],
    };
  }
}
