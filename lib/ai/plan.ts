import type { AIClient } from "./client";

export interface RepoInfo {
  name: string;
  fullName: string;
  techStack?: string[];
  defaultBranch?: string;
}

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
  brainstormResult: string | null,
  repoInfo?: RepoInfo,
): Promise<PlanResult> {
  // Skills Framework Integration - Apply planning skills
  const skillsEnabled = process.env.ENABLE_SKILLS_SYSTEM !== "false";
  let skillsPromptAugmentation = "";

  if (skillsEnabled) {
    try {
      const { invokePhaseSkills, isSkillsSystemEnabled } =
        await import("@/lib/skills");
      const { combineAugmentedPrompts } =
        await import("@/lib/skills/enforcement");

      if (isSkillsSystemEnabled()) {
        const skillContext = {
          taskId: "planning-session",
          phase: "planning" as const,
          taskDescription: title,
          workingDir: "",
          planContent: "", // Will be populated after generation
          metadata: {
            provider: client.getProvider(),
            model: client.getModel(),
          },
        };

        const skillResults = await invokePhaseSkills(
          "planning",
          skillContext,
          client,
        );

        if (skillResults.length > 0) {
          skillsPromptAugmentation = combineAugmentedPrompts("", skillResults);
        }
      }
    } catch (error) {
      // Skills framework optional
      console.warn("[Plan] Skills framework not available:", error);
    }
  }

  const repoContext = repoInfo
    ? `## REPOSITORY
Name: ${repoInfo.fullName}
${repoInfo.techStack?.length ? `Tech Stack: ${repoInfo.techStack.join(", ")}` : ""}
${repoInfo.defaultBranch ? `Default Branch: ${repoInfo.defaultBranch}` : ""}

`
    : "";

  const basePrompt = `You are an expert Scrum Master and senior software engineer facilitating Sprint Planning.

${repoContext}## TASK TO PLAN
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

  // Apply skills augmentation to prompt
  const prompt = skillsPromptAugmentation
    ? `${basePrompt}\n\n${skillsPromptAugmentation}`
    : basePrompt;

  const text = await client.chat([{ role: "user", content: prompt }], {
    maxTokens: 4096,
  });

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
        // Try to fix common JSON issues: trailing commas, unescaped quotes
        const fixedJson = jsonMatch[0]
          // Remove trailing commas before } or ]
          .replace(/,(\s*[}\]])/g, "$1")
          // Fix unescaped newlines in strings (common issue)
          .replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1\\n$2"');

        try {
          return JSON.parse(fixedJson);
        } catch {
          // Fall through to fallback
        }
      }
    }

    // Try to extract meaningful content from the response
    // Look for key fields even if full JSON is broken
    const sprintGoalMatch = cleanedText.match(/"sprintGoal"\s*:\s*"([^"]+)"/);
    const overviewMatch = cleanedText.match(/"overview"\s*:\s*"([^"]+)"/);

    // If we found some structured content, use it
    if (sprintGoalMatch || overviewMatch) {
      // Extract steps if possible
      const stepsMatch = cleanedText.match(/"steps"\s*:\s*\[([\s\S]*?)\]/);
      let steps: PlanStep[] = [];

      if (stepsMatch) {
        // Try to extract individual step objects
        const stepMatches = stepsMatch[1].matchAll(/"title"\s*:\s*"([^"]+)"/g);
        let stepIndex = 1;
        for (const match of stepMatches) {
          steps.push({
            id: String(stepIndex++),
            title: match[1],
            description: "See full plan for details",
            acceptanceCriteria: ["Task completed as specified"],
            estimatedEffort: "medium",
            priority: "high",
          });
        }
      }

      if (steps.length === 0) {
        steps = [
          {
            id: "1",
            title: "Review and implement the plan",
            description:
              "The plan structure could not be fully parsed. Review the original requirements and implement accordingly.",
            acceptanceCriteria: ["Task is implemented as specified"],
            estimatedEffort: "medium",
            priority: "high",
          },
        ];
      }

      return {
        sprintGoal: sprintGoalMatch?.[1] || "Complete the requested task",
        overview:
          overviewMatch?.[1] ||
          "Plan generated - some details may need manual review.",
        steps,
        definitionOfDone: [
          "All acceptance criteria met",
          "Code compiles without errors",
          "Basic testing completed",
        ],
        risks: [],
        verification: ["Verify the implementation works"],
      };
    }

    // Last resort: create a minimal structured response
    // Use the raw text as the overview if it's not JSON-like
    const isJsonLike = cleanedText.trim().startsWith("{");
    return {
      sprintGoal: "Complete the requested task",
      overview: isJsonLike
        ? "The AI response could not be parsed. Please regenerate the plan."
        : cleanedText.substring(0, 1000),
      steps: [
        {
          id: "1",
          title: "Implement the task",
          description: isJsonLike
            ? "Please retry the planning step to get a properly structured plan."
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
      risks: [],
      verification: ["Verify the implementation works"],
    };
  }
}
