/**
 * Agent Executor - Executes tasks using specialized agents
 */

import type {
  AgentDefinition,
  AgentExecutionContext,
  AgentResult,
  PlanStep,
} from "./types";
import type { AIClient, ChatMessage } from "@/lib/ai/client";
import { routeTaskToAgent } from "./router";
import { getAgent } from "./registry";

interface ExecuteOptions {
  /** AI client to use for execution */
  client: AIClient;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Callback for execution progress */
  onProgress?: (message: string) => void | Promise<void>;
}

/**
 * Generate the task prompt for an agent
 */
function generateTaskPrompt(
  agent: AgentDefinition,
  context: AgentExecutionContext
): string {
  const { task, workingDir, project, changeId, iteration, planContent } = context;

  let prompt = `# Task Execution

## Context
- Project: ${project}
- Change ID: ${changeId}
- Working Directory: ${workingDir}
- Iteration: ${iteration}

## Your Task
**${task.title}**

${task.description}

${task.tags?.length ? `Tags: ${task.tags.join(", ")}` : ""}

${planContent ? `## Full Plan Context\n${planContent}\n` : ""}

## Instructions
1. Implement this task following your expertise and the standards defined in your system prompt
2. Make focused, minimal changes that accomplish the task
3. Follow existing patterns in the codebase
4. If you need to create files, use appropriate paths
5. If you encounter blockers, describe them clearly

## Expected Output
Provide:
1. What changes you made
2. Files modified/created
3. Any tests added
4. Verification that the task is complete

When complete, end your response with:
\`\`\`
TASK_COMPLETE
\`\`\`

If you cannot complete the task, explain why and end with:
\`\`\`
TASK_BLOCKED: <reason>
\`\`\`
`;

  // Add previous outputs for context if available
  if (context.previousOutputs?.length) {
    prompt += `\n## Previous Agent Outputs (for context)\n`;
    for (const prev of context.previousOutputs) {
      prompt += `\n### ${prev.agentId} - ${prev.taskId}\n${prev.content.substring(0, 500)}...\n`;
    }
  }

  return prompt;
}

/**
 * Parse the agent's response for completion status and modified files
 */
function parseAgentResponse(response: string): {
  success: boolean;
  error?: string;
  modifiedFiles: string[];
} {
  const success = response.includes("TASK_COMPLETE");
  let error: string | undefined;

  // Check for blocked status
  const blockedMatch = response.match(/TASK_BLOCKED:\s*(.+)/);
  if (blockedMatch) {
    error = blockedMatch[1].trim();
  }

  // Extract modified files from common patterns
  const modifiedFiles: string[] = [];

  // Look for file paths in the response
  const filePatterns = [
    /(?:created|modified|updated|edited|wrote to|writing to)\s+[`"]?([^\s`"]+\.[a-z]+)[`"]?/gi,
    /file:\s*[`"]?([^\s`"]+\.[a-z]+)[`"]?/gi,
  ];

  for (const pattern of filePatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const filePath = match[1];
      if (!modifiedFiles.includes(filePath)) {
        modifiedFiles.push(filePath);
      }
    }
  }

  return { success, error, modifiedFiles };
}

/**
 * Execute a single task with a specific agent
 */
export async function executeWithAgent(
  agent: AgentDefinition,
  context: AgentExecutionContext,
  options: ExecuteOptions
): Promise<AgentResult> {
  const { client, maxTokens = 8192, temperature = 0.1, onProgress } = options;
  const startTime = Date.now();
  let aiCalls = 0;

  await onProgress?.(`Starting execution with ${agent.name}...`);

  // Build messages with system prompt
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: agent.systemPrompt,
    },
    {
      role: "user",
      content: generateTaskPrompt(agent, context),
    },
  ];

  try {
    // Execute the AI call
    aiCalls++;
    const response = await client.chat(messages, { maxTokens, temperature });

    await onProgress?.(`${agent.name} completed execution`);

    // Parse the response
    const { success, error, modifiedFiles } = parseAgentResponse(response);

    return {
      success,
      agentId: agent.id,
      output: response,
      modifiedFiles,
      error,
      metrics: {
        durationMs: Date.now() - startTime,
        aiCalls,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return {
      success: false,
      agentId: agent.id,
      output: "",
      modifiedFiles: [],
      error: errorMessage,
      metrics: {
        durationMs: Date.now() - startTime,
        aiCalls,
      },
    };
  }
}

/**
 * Execute a task with automatic agent routing
 */
export async function executeTask(
  task: PlanStep,
  context: Omit<AgentExecutionContext, "task">,
  options: ExecuteOptions
): Promise<AgentResult> {
  // Route to the best agent
  const routing = routeTaskToAgent(task);

  await options.onProgress?.(
    `Routing "${task.title}" to ${routing.agent.name} (confidence: ${(routing.confidence * 100).toFixed(0)}%)`
  );

  // Execute with the selected agent
  return executeWithAgent(
    routing.agent,
    { ...context, task },
    options
  );
}

/**
 * Execute a task with a specific agent ID
 */
export async function executeTaskWithAgentId(
  agentId: string,
  task: PlanStep,
  context: Omit<AgentExecutionContext, "task">,
  options: ExecuteOptions
): Promise<AgentResult> {
  const agent = getAgent(agentId);

  if (!agent) {
    return {
      success: false,
      agentId,
      output: "",
      modifiedFiles: [],
      error: `Agent not found: ${agentId}`,
      metrics: {
        durationMs: 0,
        aiCalls: 0,
      },
    };
  }

  return executeWithAgent(agent, { ...context, task }, options);
}

/**
 * Execute multiple tasks sequentially
 */
export async function executeTasksSequentially(
  tasks: PlanStep[],
  context: Omit<AgentExecutionContext, "task" | "previousOutputs">,
  options: ExecuteOptions
): Promise<Map<string, AgentResult>> {
  const results = new Map<string, AgentResult>();
  const previousOutputs: AgentExecutionContext["previousOutputs"] = [];

  for (const task of tasks) {
    const result = await executeTask(
      task,
      { ...context, previousOutputs: [...previousOutputs] },
      options
    );

    results.set(task.id, result);

    // Add to previous outputs for context
    if (result.success) {
      previousOutputs.push({
        agentId: result.agentId,
        taskId: task.id,
        content: result.output,
        modifiedFiles: result.modifiedFiles,
        success: result.success,
        timestamp: new Date(),
      });
    }

    // Stop if a task fails
    if (!result.success) {
      await options.onProgress?.(`Task "${task.title}" failed: ${result.error}`);
      break;
    }
  }

  return results;
}
