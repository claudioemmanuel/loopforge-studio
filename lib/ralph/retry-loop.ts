/**
 * Self-Correcting Retry Loop
 *
 * Handles execution retry logic with progressive format guidance
 * when file extraction fails.
 */

import type { AIClient } from "@/lib/ai/client";
import {
  smartExtractFiles,
  getFormatInstructions,
  type FileChange,
  type ExtractionResult,
} from "./smart-extractor";
import { applyFileChanges } from "./file-writer";
import { commitChanges } from "./git-operations";
import type { ExecutionEvent } from "./types";

export interface RetryContext {
  workingDir: string;
  project: string;
  changeId: string;
  taskDescription: string;
  planContent?: string;
}

export interface RetryOptions {
  client: AIClient;
  maxRetries: number;
  onEvent: (event: ExecutionEvent) => void | Promise<void>;
}

export interface RetryResult {
  success: boolean;
  files: FileChange[];
  commits: string[];
  output: string;
  method: ExtractionResult["method"];
  needsIntervention: boolean;
  retryCount: number;
  error?: string;
}

/**
 * Build prompt with format instructions for retry
 */
function buildRetryPrompt(
  context: RetryContext,
  previousOutput: string,
  attempt: number,
): string {
  const formatInstructions = getFormatInstructions();

  return `You are an AI coding assistant. Your previous response could not be processed because the file changes were not in a recognizable format.

${formatInstructions}

TASK: ${context.taskDescription}

${context.planContent ? `PLAN:\n${context.planContent}\n` : ""}

Your previous output (attempt ${attempt - 1}) did not contain extractable file changes.
Please provide your code changes again using the formats described above.

Focus on:
1. Using explicit file path annotations
2. Including COMPLETE file contents (not snippets)
3. One code block per file

Please implement the required changes now:`;
}

/**
 * Execute a single attempt and try to extract files
 */
async function executeAttempt(
  prompt: string,
  context: RetryContext,
  options: RetryOptions,
  attempt: number,
): Promise<{
  output: string;
  extraction: ExtractionResult;
}> {
  const { client, onEvent } = options;

  await onEvent({
    type: "thinking",
    content: `Attempt ${attempt}: Generating code changes...`,
    timestamp: new Date(),
    metadata: { attempt },
  });

  const output = await client.chat([{ role: "user", content: prompt }], {
    maxTokens: 8192,
  });

  await onEvent({
    type: "thinking",
    content: `Attempt ${attempt}: Extracting file changes...`,
    timestamp: new Date(),
    metadata: { attempt, outputLength: output.length },
  });

  // Try to extract files (with AI fallback on last attempt)
  const extraction = await smartExtractFiles(
    output,
    attempt === options.maxRetries ? client : undefined,
  );

  return { output, extraction };
}

/**
 * Execute with self-correcting retry loop
 *
 * Tries to execute a task and extract file changes. If extraction fails,
 * retries with explicit format instructions. After max retries, returns
 * with needsIntervention flag set.
 */
export async function executeWithRetry(
  initialPrompt: string,
  context: RetryContext,
  options: RetryOptions,
): Promise<RetryResult> {
  const { maxRetries, onEvent } = options;
  const commits: string[] = [];
  let lastOutput = "";
  let lastExtraction: ExtractionResult = {
    files: [],
    method: "none",
    warnings: [],
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isRetry = attempt > 1;
    const prompt = isRetry
      ? buildRetryPrompt(context, lastOutput, attempt)
      : initialPrompt;

    try {
      const { output, extraction } = await executeAttempt(
        prompt,
        context,
        options,
        attempt,
      );

      lastOutput = output;
      lastExtraction = extraction;

      // Log extraction result
      await onEvent({
        type: "thinking",
        content: `Attempt ${attempt}: Found ${extraction.files.length} file(s) via ${extraction.method} extraction`,
        timestamp: new Date(),
        metadata: {
          attempt,
          fileCount: extraction.files.length,
          method: extraction.method,
          warnings: extraction.warnings,
        },
      });

      // Check if we got extractable files
      if (extraction.files.length > 0) {
        // Apply file changes
        await onEvent({
          type: "file_write",
          content: `Writing ${extraction.files.length} file(s): ${extraction.files.map((f) => f.path).join(", ")}`,
          timestamp: new Date(),
          metadata: { files: extraction.files.map((f) => f.path) },
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

        // Commit if files were written
        if (writeResult.writtenFiles.length > 0) {
          try {
            const commitResult = await commitChanges(
              context.workingDir,
              `feat(${context.changeId}): implement changes (attempt ${attempt})`,
              writeResult.writtenFiles,
            );
            commits.push(commitResult.sha);

            await onEvent({
              type: "commit",
              content: `Committed ${commitResult.filesChanged} file(s): ${commitResult.sha.slice(0, 7)}`,
              timestamp: new Date(),
              metadata: {
                commitSha: commitResult.sha,
                filesChanged: commitResult.filesChanged,
              },
            });
          } catch (commitError) {
            await onEvent({
              type: "error",
              content: `Commit failed: ${commitError instanceof Error ? commitError.message : "Unknown error"}`,
              timestamp: new Date(),
            });
          }
        }

        // Success!
        return {
          success: true,
          files: extraction.files,
          commits,
          output: lastOutput,
          method: extraction.method,
          needsIntervention: false,
          retryCount: attempt,
        };
      }

      // No files extracted, will retry if attempts remain
      if (attempt < maxRetries) {
        await onEvent({
          type: "thinking",
          content: `Attempt ${attempt} produced no extractable code. Retrying with format guidance...`,
          timestamp: new Date(),
          metadata: { attempt, warnings: extraction.warnings },
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await onEvent({
        type: "error",
        content: `Attempt ${attempt} failed: ${errorMessage}`,
        timestamp: new Date(),
        metadata: { attempt, error: errorMessage },
      });

      // Continue to next attempt on error
      if (attempt < maxRetries) {
        await onEvent({
          type: "thinking",
          content: `Retrying after error...`,
          timestamp: new Date(),
        });
      }
    }
  }

  // All retries exhausted
  await onEvent({
    type: "stuck",
    content: `Could not extract code after ${maxRetries} attempts. Manual intervention required.`,
    timestamp: new Date(),
    metadata: {
      maxRetries,
      lastMethod: lastExtraction.method,
      warnings: lastExtraction.warnings,
    },
  });

  return {
    success: false,
    files: [],
    commits,
    output: lastOutput,
    method: lastExtraction.method,
    needsIntervention: true,
    retryCount: maxRetries,
    error: `Could not extract code after ${maxRetries} attempts`,
  };
}

/**
 * Verify that actual work was done
 * Returns true if files were modified and/or commits were made
 */
export function verifyWorkCompleted(result: RetryResult): {
  verified: boolean;
  reason?: string;
} {
  if (result.files.length === 0) {
    return {
      verified: false,
      reason: "No files were extracted from agent output",
    };
  }

  if (result.commits.length === 0) {
    return {
      verified: false,
      reason: "No commits were made - files may not have been written",
    };
  }

  return { verified: true };
}
