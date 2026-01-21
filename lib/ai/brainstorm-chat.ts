import type { AIClient, ChatMessage } from "./client";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

export interface BrainstormOption {
  label: string;
  value: string;
}

export interface BrainstormChatResponse {
  message: string;
  options?: BrainstormOption[];
  brainstormPreview?: {
    summary: string;
    requirements: string[];
    considerations: string[];
    suggestedApproach: string;
  };
  suggestComplete?: boolean;
}

export interface RepoContext {
  techStack: string[];
  fileStructure: string[];
  configFiles: string[];
  relevantCode?: Record<string, string>;
}

export interface BrainstormConversation {
  taskId: string;
  messages: ChatMessage[];
  repoContext: RepoContext;
  currentPreview?: BrainstormChatResponse["brainstormPreview"];
}

// In-memory store for active conversations (not persisted)
const activeConversations = new Map<string, BrainstormConversation>();

export function getConversation(taskId: string): BrainstormConversation | undefined {
  return activeConversations.get(taskId);
}

export function setConversation(taskId: string, conversation: BrainstormConversation): void {
  activeConversations.set(taskId, conversation);
}

export function deleteConversation(taskId: string): void {
  activeConversations.delete(taskId);
}

// Quick scan for repo context
export async function scanRepository(repoPath: string): Promise<RepoContext> {
  const techStack: string[] = [];
  const fileStructure: string[] = [];
  const configFiles: string[] = [];

  try {
    // Read top-level directory
    const entries = await readdir(repoPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        fileStructure.push(`${entry.name}/`);
      } else if (entry.isFile()) {
        fileStructure.push(entry.name);
      }
    }

    // Check for common config files to detect tech stack
    const configChecks = [
      { file: "package.json", tech: "Node.js" },
      { file: "tsconfig.json", tech: "TypeScript" },
      { file: "next.config.ts", tech: "Next.js" },
      { file: "next.config.js", tech: "Next.js" },
      { file: "tailwind.config.ts", tech: "Tailwind CSS" },
      { file: "tailwind.config.js", tech: "Tailwind CSS" },
      { file: "drizzle.config.ts", tech: "Drizzle ORM" },
      { file: "Cargo.toml", tech: "Rust" },
      { file: "pyproject.toml", tech: "Python" },
      { file: "go.mod", tech: "Go" },
    ];

    for (const check of configChecks) {
      try {
        await stat(join(repoPath, check.file));
        techStack.push(check.tech);
        configFiles.push(check.file);
      } catch {
        // File doesn't exist, skip
      }
    }

    // Read package.json for more details if it exists
    try {
      const pkgContent = await readFile(join(repoPath, "package.json"), "utf-8");
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps["react"]) techStack.push("React");
      if (deps["drizzle-orm"]) techStack.push("Drizzle ORM");
      if (deps["next-auth"]) techStack.push("NextAuth");
      if (deps["stripe"]) techStack.push("Stripe");
    } catch {
      // No package.json or invalid
    }

  } catch (error) {
    console.error("Error scanning repository:", error);
  }

  return {
    techStack: [...new Set(techStack)], // Dedupe
    fileStructure: fileStructure.slice(0, 20), // Limit to 20 entries
    configFiles,
  };
}

const SYSTEM_PROMPT = `You are an expert Scrum Master and senior software engineer facilitating task refinement through focused conversation.

YOUR ROLE:
- Facilitate clear understanding of the task using Scrum backlog refinement techniques
- Break down tasks into actionable, estimable work items
- Ensure acceptance criteria are clear and testable
- Identify dependencies, risks, and blockers early

SCRUM REFINEMENT FRAMEWORK:
1. STORY CLARITY - Ensure the "what" and "why" are crystal clear
2. ACCEPTANCE CRITERIA - Define specific, testable conditions for "done"
3. TASK BREAKDOWN - Identify concrete implementation steps
4. DEPENDENCIES - Surface blockers, prerequisites, or related work
5. RISKS - Identify potential challenges or unknowns
6. ESTIMATION INPUT - Gather info needed for accurate estimation

CRITICAL RULES:
1. STAY ON TOPIC - Questions MUST relate directly to the original task. Never deviate.
2. ACCUMULATE - BUILD UPON existing brainstorm, adding details, NOT replacing.
3. BE SPECIFIC - Use Scrum refinement questions specific to THIS task.
4. KNOW WHEN TO STOP - After gathering: acceptance criteria, key tasks, and risks → suggest completion.

REFINEMENT QUESTIONS TO ASK (pick 1-2 relevant to current state):
- Acceptance Criteria: "What specific conditions must be met for this to be considered done?"
- Scope: "Should this include X, or is that a separate task?"
- Edge Cases: "How should we handle [specific scenario]?"
- Dependencies: "Does this require any other work to be completed first?"
- Testing: "How will we verify this works correctly?"
- Priority: "Which part is most critical to complete first?"

COMPLETION CRITERIA (set suggestComplete=true when you have):
✓ Clear acceptance criteria (at least 2-3 testable conditions)
✓ Identified main implementation steps or approach
✓ Surfaced key risks or considerations
✓ User indicates satisfaction OR you've asked 2-3 focused questions

RESPONSE FORMAT (JSON only):
{
  "message": "Acknowledge input, then ask ONE Scrum-focused refinement question OR summarize if ready",
  "options": [
    { "label": "Specific option for THIS task", "value": "option1" },
    { "label": "Another relevant option", "value": "option2" },
    { "label": "This looks complete, ready to proceed", "value": "ready" }
  ],
  "brainstormPreview": {
    "summary": "Clear task summary with refined details",
    "requirements": ["KEEP all existing", "ADD new acceptance criteria as requirements"],
    "considerations": ["KEEP existing", "ADD risks, dependencies, edge cases"],
    "suggestedApproach": "REFINED approach with concrete steps"
  },
  "suggestComplete": false
}

IMPORTANT:
- ALWAYS include "ready to proceed" as the last option so users can stop when satisfied
- brainstormPreview MUST MERGE new insights with existing content, never discard
- If task is about "unit tests", ask about test coverage, modules to test, mocking needs - NOT about CRUD endpoints
- Keep questions actionable and decision-focused, not open-ended exploration

Respond ONLY with valid JSON, no markdown or extra text.`;

export async function chatWithAI(
  client: AIClient,
  conversation: BrainstormConversation,
  userMessage: string,
  taskTitle?: string
): Promise<BrainstormChatResponse> {
  // Build comprehensive context message with current state
  let contextMsg = `Repository Context:
- Tech Stack: ${conversation.repoContext.techStack.join(", ") || "Unknown"}
- Structure: ${conversation.repoContext.fileStructure.join(", ")}`;

  // Include task title if available
  if (taskTitle) {
    contextMsg += `\n\nORIGINAL TASK: "${taskTitle}"
IMPORTANT: All questions and refinements MUST relate to this specific task.`;
  }

  // Include current preview so AI knows what to build upon
  if (conversation.currentPreview) {
    contextMsg += `\n\nCURRENT BRAINSTORM STATE (you must BUILD UPON this, not replace):
- Summary: ${conversation.currentPreview.summary}
- Requirements: ${conversation.currentPreview.requirements.join("; ")}
- Considerations: ${conversation.currentPreview.considerations.join("; ")}
- Approach: ${conversation.currentPreview.suggestedApproach}

Your brainstormPreview response MUST include ALL existing items plus any new refinements.`;
  }

  // Build messages array
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: contextMsg },
    ...conversation.messages,
    { role: "user", content: userMessage },
  ];

  const response = await client.chat(messages, { maxTokens: 2048 });

  // Strip markdown code blocks if present
  let cleanedResponse = response.trim();
  const jsonMatch = cleanedResponse.match(/^```json\s*([\s\S]*?)\s*```$/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[1].trim();
  } else if (cleanedResponse.startsWith("```")) {
    cleanedResponse = cleanedResponse.slice(3);
    if (cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();
  }

  try {
    const parsed = JSON.parse(cleanedResponse) as BrainstormChatResponse;
    return parsed;
  } catch {
    // Fallback if JSON parsing fails
    return {
      message: cleanedResponse || "I had trouble processing that. Could you try rephrasing?",
      suggestComplete: false,
    };
  }
}

export interface ExistingBrainstormContext {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

export async function initializeBrainstorm(
  client: AIClient,
  taskTitle: string,
  taskDescription: string | null,
  repoContext: RepoContext,
  existingBrainstorm?: ExistingBrainstormContext
): Promise<BrainstormChatResponse> {
  let initialPrompt: string;

  if (existingBrainstorm) {
    // Refining existing brainstorm using Scrum refinement approach
    initialPrompt = `BACKLOG REFINEMENT SESSION for: "${taskTitle}"

You are facilitating a Scrum-style backlog refinement for this task.
${taskDescription ? `Description: ${taskDescription}` : ""}

Tech Stack: ${repoContext.techStack.join(", ")}

CURRENT BACKLOG ITEM STATE:
- Summary: ${existingBrainstorm.summary}
- Requirements/Acceptance Criteria: ${existingBrainstorm.requirements.join("; ")}
- Considerations/Risks: ${existingBrainstorm.considerations.join("; ")}
- Implementation Approach: ${existingBrainstorm.suggestedApproach}

YOUR TASK:
1. Briefly acknowledge the existing refinement work
2. Ask ONE focused Scrum refinement question to add clarity:
   - Acceptance criteria specifics
   - Scope boundaries (what's in/out)
   - Dependencies or blockers
   - Definition of done details
   - Testing approach
   - Priority within the task

Options MUST be specific to "${taskTitle}" - not generic development questions.
Example for "unit tests" task: ask about coverage targets, specific modules, mocking strategies, etc.

ALWAYS include "This looks good, ready to proceed" as the last option.
Your brainstormPreview MUST include ALL existing items plus any refinements.`;
  } else {
    // New brainstorm
    initialPrompt = `New brainstorming session started.

Task Title: ${taskTitle}
${taskDescription ? `Task Description: ${taskDescription}` : "No description provided."}

Repository Context:
- Tech Stack: ${repoContext.techStack.join(", ") || "Unknown"}
- File Structure: ${repoContext.fileStructure.join(", ")}

Please introduce yourself briefly, acknowledge the task, and ask your first clarifying question with multiple-choice options.`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialPrompt },
  ];

  const response = await client.chat(messages, { maxTokens: 2048 });

  // Strip markdown code blocks
  let cleanedResponse = response.trim();
  const jsonMatch = cleanedResponse.match(/^```json\s*([\s\S]*?)\s*```$/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleanedResponse) as BrainstormChatResponse;
    // If refining, pre-populate the preview with existing data
    if (existingBrainstorm && !parsed.brainstormPreview) {
      parsed.brainstormPreview = existingBrainstorm;
    }
    return parsed;
  } catch {
    return {
      message: existingBrainstorm
        ? "I see you've already brainstormed this. What would you like to refine?"
        : "Let's brainstorm this task together. What's the main goal you're trying to achieve?",
      options: existingBrainstorm
        ? [
            { label: "Clarify acceptance criteria", value: "acceptance_criteria" },
            { label: "Define scope boundaries", value: "scope" },
            { label: "Identify dependencies or risks", value: "dependencies" },
            { label: "This looks good, ready to proceed", value: "ready" },
          ]
        : [
            { label: "Add a new feature", value: "new_feature" },
            { label: "Fix a bug", value: "bug_fix" },
            { label: "Refactor existing code", value: "refactor" },
            { label: "Something else", value: "other" },
          ],
      brainstormPreview: existingBrainstorm,
      suggestComplete: false,
    };
  }
}
