import {
  type LoopResult,
  type ExecutionEvent,
  type CompletionStatus,
  RALPH_COMPLETE,
  RALPH_STUCK,
} from "./types";
import { generatePrompt, type PromptContext } from "./prompt-generator";
import type { AIClient } from "@/lib/ai/client";
import type {
  ParallelExecutionOptions,
  ExecutionProgress,
} from "@/lib/agents/types";
import { runParallelExecution, getExecutionSummary } from "./parallel-executor";
import { applyFileChanges } from "./file-writer";
import { smartExtractFiles, getFormatInstructions } from "./smart-extractor";
import { commitChanges } from "./git-operations";

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
  options: LoopOptions,
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
  options: LoopOptions,
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
      },
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

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
 * Classic single-agent execution mode (with smart extraction and retry)
 */
async function runClassicLoop(
  context: LoopContext,
  options: LoopOptions,
): Promise<LoopResult> {
  const { client, maxIterations, stuckThreshold, onEvent } = options;
  const commits: string[] = [];
  let iteration = 1;
  let stuckCount = 0;
  let consecutiveNoFileIterations = 0;
  const maxNoFileRetries = 2; // Retry with format instructions if no files found

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

    let prompt = generatePrompt(promptContext);

    // Add format instructions if previous iterations produced no files
    if (consecutiveNoFileIterations > 0) {
      prompt = `${getFormatInstructions()}\n\n${prompt}`;
      await onEvent({
        type: "thinking",
        content: `Added format instructions due to ${consecutiveNoFileIterations} iteration(s) without extractable code`,
        timestamp: new Date(),
      });
    }

    try {
      const output = await client.chat([{ role: "user", content: prompt }], {
        maxTokens: 8192,
      });

      await onEvent({
        type: "thinking",
        content: `Iteration ${iteration} completed`,
        metadata: { output: output.substring(0, 500) },
        timestamp: new Date(),
      });

      // Use smart extraction with fuzzy matching
      // Pass client for AI-assisted extraction on retry attempts
      const useAiAssisted = consecutiveNoFileIterations >= maxNoFileRetries;
      const extraction = await smartExtractFiles(
        output,
        useAiAssisted ? client : undefined,
      );

      await onEvent({
        type: "thinking",
        content: `Extraction: ${extraction.files.length} file(s) via ${extraction.method}`,
        metadata: {
          method: extraction.method,
          fileCount: extraction.files.length,
          warnings: extraction.warnings,
        },
        timestamp: new Date(),
      });

      if (extraction.files.length === 0) {
        consecutiveNoFileIterations++;

        if (consecutiveNoFileIterations > maxNoFileRetries) {
          // Too many iterations without files - this is a problem
          await onEvent({
            type: "stuck",
            content: `No extractable code after ${consecutiveNoFileIterations} attempts. Agent may not be producing code in a parseable format.`,
            metadata: {
              outputLength: output.length,
              warnings: extraction.warnings,
            },
            timestamp: new Date(),
          });

          // Check if output indicates completion anyway
          const status = checkCompletion(output);
          if (status === "complete") {
            return {
              status: "stuck",
              iterations: iteration,
              commits,
              error: "Agent reported completion but no code was extracted",
            };
          }
        } else {
          await onEvent({
            type: "thinking",
            content: `No file changes detected (attempt ${consecutiveNoFileIterations}/${maxNoFileRetries}). Will retry with format guidance.`,
            metadata: { outputLength: output.length },
            timestamp: new Date(),
          });
        }
      } else {
        // Successfully extracted files - reset counter
        consecutiveNoFileIterations = 0;

        await onEvent({
          type: "file_write",
          content: `Writing ${extraction.files.length} file(s): ${extraction.files.map((f) => f.path).join(", ")}`,
          metadata: {
            files: extraction.files.map((f) => f.path),
            method: extraction.method,
          },
          timestamp: new Date(),
        });

        const writeResult = await applyFileChanges(
          context.workingDir,
          extraction.files.map((f) => ({
            path: f.path,
            action: f.action,
            content: f.content,
          })),
        );

        if (writeResult.errors.length > 0) {
          await onEvent({
            type: "error",
            content: `File write errors: ${writeResult.errors.map((e) => `${e.path}: ${e.error}`).join("; ")}`,
            timestamp: new Date(),
          });
        }

        if (writeResult.writtenFiles.length > 0) {
          // Commit the changes
          try {
            const commitResult = await commitChanges(
              context.workingDir,
              `feat: iteration ${iteration} changes`,
              writeResult.writtenFiles,
            );
            commits.push(commitResult.sha);

            await onEvent({
              type: "commit",
              content: `Committed ${commitResult.filesChanged} file(s)`,
              metadata: {
                commitSha: commitResult.sha,
                filesChanged: commitResult.filesChanged,
              },
              timestamp: new Date(),
            });
          } catch (commitError) {
            await onEvent({
              type: "error",
              content: `Commit failed: ${commitError instanceof Error ? commitError.message : "Unknown error"}`,
              timestamp: new Date(),
            });
          }
        }
      }

      // Check completion status
      const status = checkCompletion(output);

      if (status === "complete") {
        // Verify we actually did work before claiming success
        if (commits.length === 0) {
          await onEvent({
            type: "stuck",
            content: "Agent reported completion but no commits were made",
            timestamp: new Date(),
          });

          return {
            status: "stuck",
            iterations: iteration,
            commits,
            error: "No commits made despite agent reporting completion",
          };
        }

        await onEvent({
          type: "complete",
          content: `All tasks completed successfully (${commits.length} commit(s))`,
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
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
