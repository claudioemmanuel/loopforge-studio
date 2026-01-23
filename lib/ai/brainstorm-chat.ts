import type { AIClient, ChatMessage } from "./client";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

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
      // Not valid JSON object, continue
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

  // Use robust JSON extraction
  const parsed = extractJSON(response);
  if (parsed && "message" in parsed) {
    return parsed as BrainstormChatResponse;
  }

  // Fallback if JSON parsing fails
  return {
    message: response.trim() || "I had trouble processing that. Could you try rephrasing?",
    suggestComplete: false,
  };
}

export interface ExistingBrainstormContext {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

/**
 * Get task-specific prompts based on task type detection.
 * Helps the AI provide more relevant analysis for common task categories.
 */
function getTaskSpecificPrompt(title: string, description: string | null): string {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = (description || "").toLowerCase();
  const combined = `${lowerTitle} ${lowerDesc}`;

  // Testing tasks
  if (combined.includes("test") || combined.includes("coverage") || combined.includes("spec")) {
    return `
TASK TYPE: Testing/Coverage

For this testing task, focus on:
- Which modules or files need test coverage
- What types of tests are needed (unit, integration, e2e)
- Mocking strategies for external dependencies
- Edge cases and error scenarios to cover
- Coverage targets and how to measure them

If test context is provided below, use it to identify specific files needing tests.`;
  }

  // Refactoring tasks
  if (combined.includes("refactor") || combined.includes("cleanup") || combined.includes("reorganize")) {
    return `
TASK TYPE: Refactoring

For this refactoring task, focus on:
- Identify the specific code to refactor
- Patterns or principles to apply (DRY, SOLID, etc.)
- Before/after structure comparison
- How to maintain backwards compatibility
- Testing strategy to prevent regressions`;
  }

  // Bug fix tasks
  if (combined.includes("fix") || combined.includes("bug") || combined.includes("issue") || combined.includes("error")) {
    return `
TASK TYPE: Bug Fix

For this bug fix task, focus on:
- Root cause analysis approach
- How to reproduce the issue
- Potential areas of code to investigate
- Testing to verify the fix
- Regression prevention`;
  }

  // Performance tasks
  if (combined.includes("performance") || combined.includes("optimize") || combined.includes("speed") || combined.includes("slow")) {
    return `
TASK TYPE: Performance Optimization

For this performance task, focus on:
- Profiling and measurement approach
- Key metrics to track (load time, response time, memory)
- Potential bottlenecks to investigate
- Optimization strategies to consider
- Before/after benchmarking`;
  }

  // Feature tasks (default)
  return `
TASK TYPE: Feature Implementation

For this feature task, focus on:
- User-facing behavior and acceptance criteria
- Integration points with existing code
- Data model changes if needed
- UI/UX considerations
- Testing requirements`;
}

// Generate initial brainstorm result without chat interaction
// Used for the "Start Brainstorming" button - generates result directly
export async function generateInitialBrainstorm(
  client: AIClient,
  taskTitle: string,
  taskDescription: string | null,
  repoContext: RepoContext
): Promise<BrainstormChatResponse["brainstormPreview"]> {
  const taskSpecificPrompt = getTaskSpecificPrompt(taskTitle, taskDescription);

  const prompt = `You are an expert Scrum Master analyzing a task for sprint planning.

TASK: "${taskTitle}"
${taskDescription ? `DESCRIPTION: ${taskDescription}` : ""}
${taskSpecificPrompt}

REPOSITORY CONTEXT:
- Tech Stack: ${repoContext.techStack.join(", ") || "Unknown"}
- File Structure: ${repoContext.fileStructure.join(", ")}
${repoContext.configFiles.length > 0 ? `- Config Files: ${repoContext.configFiles.join(", ")}` : ""}

Generate a comprehensive initial brainstorm analysis. Be SPECIFIC to this task and repository.
Do NOT provide generic placeholders - analyze the actual context provided.

Provide:
1. A clear summary of what needs to be done (specific to the codebase)
2. Key requirements and acceptance criteria (3-5 SPECIFIC items)
3. Technical considerations, risks, or edge cases (2-4 items based on tech stack)
4. A suggested implementation approach (referencing actual files/patterns)

RESPOND WITH JSON ONLY:
{
  "summary": "Clear, actionable summary of the task",
  "requirements": ["Specific requirement 1", "Specific requirement 2", "..."],
  "considerations": ["Technical consideration 1", "Risk or edge case 2", "..."],
  "suggestedApproach": "High-level approach referencing actual codebase structure"
}`;

  const messages: ChatMessage[] = [
    { role: "user", content: prompt },
  ];

  const response = await client.chat(messages, { maxTokens: 2048 });

  // Use robust JSON extraction
  const parsed = extractJSON(response);
  if (parsed && typeof parsed === "object") {
    const data = parsed as Record<string, unknown>;
    return {
      summary: (data.summary as string) || `Analysis of: ${taskTitle}`,
      requirements: Array.isArray(data.requirements) ? data.requirements : [],
      considerations: Array.isArray(data.considerations) ? data.considerations : [],
      suggestedApproach: (data.suggestedApproach as string) || "Further refinement needed",
    };
  }

  // Return a basic structure if parsing fails
  console.error("[generateInitialBrainstorm] JSON extraction failed, raw response:", response.slice(0, 200));
  return {
    summary: `Initial analysis of: ${taskTitle}`,
    requirements: ["Define detailed requirements through refinement"],
    considerations: ["Technical approach needs discussion"],
    suggestedApproach: "Use the Refine button to interactively clarify this task",
  };
}

// Export for testing
export { getTaskSpecificPrompt };

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

  // Use robust JSON extraction
  const parsed = extractJSON(response);
  if (parsed && "message" in parsed) {
    const result = parsed as BrainstormChatResponse;
    // If refining, pre-populate the preview with existing data
    if (existingBrainstorm && !result.brainstormPreview) {
      result.brainstormPreview = existingBrainstorm;
    }
    return result;
  }

  // Fallback response
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
