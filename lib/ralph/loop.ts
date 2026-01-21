import {
  type LoopResult,
  type ExecutionEvent,
  type CompletionStatus,
  RALPH_COMPLETE,
  RALPH_STUCK,
} from "./types";
import { generatePrompt, type PromptContext } from "./prompt-generator";
import type { AIClient } from "@/lib/ai/client";
import type { ParallelExecutionOptions, ExecutionProgress } from "@/lib/agents/types";
import { runParallelExecution, getExecutionSummary } from "./parallel-executor";

export type ExecutionMode = "classic" | "multi-agent";

export interface LoopOptions {
  client: AIClient;
  maxIterations: number;
  stuckThreshold: number;
  onEvent: (event: ExecutionEvent) => void | Promise<void>;
  /** Execution mode: 'classic' for original single-agent, 'multi-agent' for parallel specialized agents */
  mode?: ExecutionMode;
  /** Options for multi-agent mode */
  parallelOptions?: Partial<ParallelExecutionOptions>;
  /** Callback for progress updates (multi-agent mode) */
  onProgress?: (progress: ExecutionProgress) => void | Promise<void>;
}

export interface LoopContext {
  project: string;
  changeId: string;
  workingDir: string;
  tasksPath: string;
  quickVerify: string;
  fullVerify: string;
  doConstraints: string[];
  dontConstraints: string[];
  /** Plan content for multi-agent execution */
  planContent?: string;
}

function checkCompletion(output: string): CompletionStatus {
  if (output.includes(RALPH_COMPLETE)) {
    return "complete";
  }
  if (output.includes(RALPH_STUCK)) {
    return "stuck";
  }
  return "continue";
}

function extractStuckReason(output: string): string | undefined {
  const match = output.match(/RALPH_STUCK:\s*(.+)/);
  return match ? match[1].trim() : undefined;
}

export async function runLoop(
  context: LoopContext,
  options: LoopOptions
): Promise<LoopResult> {
  const { mode = "classic" } = options;

  // Use multi-agent parallel execution if specified
  if (mode === "multi-agent" && context.planContent) {
    return runMultiAgentLoop(context, options);
  }

  // Classic single-agent execution
  return runClassicLoop(context, options);
}

/**
 * Multi-agent parallel execution mode
 */
async function runMultiAgentLoop(
  context: LoopContext,
  options: LoopOptions
): Promise<LoopResult> {
  const { client, onEvent, parallelOptions, onProgress } = options;

  await onEvent({
    type: "thinking",
    content: `Starting multi-agent execution (using ${client.getProvider()}/${client.getModel()})`,
    timestamp: new Date(),
  });

  try {
    const result = await runParallelExecution(
      {
        workingDir: context.workingDir,
        project: context.project,
        changeId: context.changeId,
        planContent: context.planContent!,
      },
      {
        client,
        options: parallelOptions,
        onEvent,
        onProgress,
      }
    );

    // Log summary
    const summary = getExecutionSummary(result);
    await onEvent({
      type: result.success ? "complete" : "stuck",
      content: summary,
      timestamp: new Date(),
    });

    // Map result to LoopResult format
    return {
      status: result.success ? "complete" : "stuck",
      iterations: result.taskResults.size,
      commits: result.commits,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await onEvent({
      type: "error",
      content: `Multi-agent execution failed: ${errorMessage}`,
      timestamp: new Date(),
    });

    return {
      status: "stuck",
      iterations: 0,
      commits: [],
      error: errorMessage,
    };
  }
}

/**
 * Classic single-agent execution mode (original behavior)
 */
async function runClassicLoop(
  context: LoopContext,
  options: LoopOptions
): Promise<LoopResult> {
  const { client, maxIterations, stuckThreshold, onEvent } = options;
  const commits: string[] = [];
  let iteration = 1;
  let stuckCount = 0;

  while (iteration <= maxIterations) {
    await onEvent({
      type: "thinking",
      content: `Starting iteration ${iteration} (using ${client.getProvider()}/${client.getModel()})`,
      timestamp: new Date(),
    });

    const promptContext: PromptContext = {
      project: context.project,
      changeId: context.changeId,
      iteration,
      workingDir: context.workingDir,
      tasksPath: context.tasksPath,
      quickVerify: context.quickVerify,
      fullVerify: context.fullVerify,
      doConstraints: context.doConstraints,
      dontConstraints: context.dontConstraints,
    };

    const prompt = generatePrompt(promptContext);

    try {
      const output = await client.chat(
        [{ role: "user", content: prompt }],
        { maxTokens: 8192 }
      );

      await onEvent({
        type: "thinking",
        content: `Iteration ${iteration} completed`,
        metadata: { output: output.substring(0, 500) },
        timestamp: new Date(),
      });

      // Check completion status
      const status = checkCompletion(output);

      if (status === "complete") {
        await onEvent({
          type: "complete",
          content: "All tasks completed successfully",
          timestamp: new Date(),
        });

        return {
          status: "complete",
          iterations: iteration,
          commits,
        };
      }

      if (status === "stuck") {
        const reason = extractStuckReason(output) || "Unknown reason";
        await onEvent({
          type: "stuck",
          content: `Stuck: ${reason}`,
          timestamp: new Date(),
        });

        return {
          status: "stuck",
          iterations: iteration,
          commits,
          error: reason,
        };
      }

      // Continue to next iteration
      iteration++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await onEvent({
        type: "error",
        content: `Error in iteration ${iteration}: ${errorMessage}`,
        timestamp: new Date(),
      });

      stuckCount++;
      if (stuckCount >= stuckThreshold) {
        return {
          status: "stuck",
          iterations: iteration,
          commits,
          error: `Failed after ${stuckCount} consecutive errors: ${errorMessage}`,
        };
      }
    }
  }

  // Max iterations reached
  await onEvent({
    type: "stuck",
    content: `Max iterations (${maxIterations}) reached`,
    timestamp: new Date(),
  });

  return {
    status: "stuck",
    iterations: iteration,
    commits,
    error: `Max iterations (${maxIterations}) reached`,
  };
}
