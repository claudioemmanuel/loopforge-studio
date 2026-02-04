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
import {
  StuckDetector,
  LegacyStuckChecker,
  type StuckSignal,
} from "./stuck-detector";
import { RecoveryOrchestrator } from "./recovery-strategies";
import {
  CompletionValidator,
  LegacyCompletionChecker,
} from "./completion-validator";
import {
  getFeatureFlag,
  areReliabilityFeaturesEnabled,
} from "@/lib/config/feature-flags";
import {
  createRecoveryEvent,
  publishRecoveryEvent,
} from "@/lib/workers/events";

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
  /** User ID for recovery event publishing */
  userId?: string;
  /** Task ID for recovery event publishing */
  taskId?: string;
  /** Task title for recovery event publishing */
  taskTitle?: string;
  /** Repository name for recovery event publishing */
  repoName?: string;
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

  // Initialize reliability modules based on feature flags
  const useStuckDetector = getFeatureFlag("ENABLE_STUCK_DETECTOR");
  const useRecovery = getFeatureFlag("ENABLE_RECOVERY_STRATEGIES");
  const useCompletionValidation = getFeatureFlag(
    "ENABLE_COMPLETION_VALIDATION",
  );

  const stuckDetector = useStuckDetector
    ? new StuckDetector({
        maxConsecutiveErrors: stuckThreshold,
        iterationTimeoutMinutes: 10,
        progressCommitThreshold: 3,
      })
    : new LegacyStuckChecker(stuckThreshold);

  const recoveryOrchestrator = useRecovery ? new RecoveryOrchestrator() : null;

  const completionValidator = useCompletionValidation
    ? new CompletionValidator()
    : new LegacyCompletionChecker();

  // Track reliability data
  const reliabilityData: {
    stuckSignals?: StuckSignal[];
    recoveryAttempts?: Array<{
      tier: string;
      success: boolean;
      iteration: number;
    }>;
    validationReport?: unknown;
  } = {};

  while (iteration <= maxIterations) {
    await onEvent({
      type: "thinking",
      content: `Starting iteration ${iteration} (using ${client.getProvider()}/${client.getModel()})`,
      timestamp: new Date(),
    });

    // Skills Framework Integration - Invoke applicable skills at iteration start
    const skillsEnabled = process.env.ENABLE_SKILLS_SYSTEM !== "false";
    let skillResults: Array<{ skillId: string; status: string }> = [];

    if (skillsEnabled) {
      try {
        const { invokePhaseSkills, isSkillsSystemEnabled } =
          await import("@/lib/skills");

        if (isSkillsSystemEnabled()) {
          const skillContext = {
            taskId: context.changeId,
            phase: "executing" as const,
            taskDescription: context.project,
            workingDir: context.workingDir,
            iteration,
            modifiedFiles: [], // Would be populated from git status
            commits: [], // Would be populated from git log
            executionId: context.changeId,
          };

          skillResults = await invokePhaseSkills(
            "executing",
            skillContext,
            client,
          );

          if (skillResults.length > 0) {
            await onEvent({
              type: "thinking",
              content: `Skills executed: ${skillResults.map((r) => `${r.skillId}(${r.status})`).join(", ")}`,
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        // Skills framework optional - don't fail if not available
        console.warn("[Ralph] Skills framework not available:", error);
      }
    }

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

    // Apply skill-augmented prompts if available
    if (skillResults.length > 0) {
      try {
        const { combineAugmentedPrompts } =
          await import("@/lib/skills/enforcement");
        prompt = combineAugmentedPrompts(prompt, skillResults);
      } catch (error) {
        // Ignore if enforcement module not available
      }
    }

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

      // Use smart extraction with progressive strategies
      const useEnhancedExtraction = getFeatureFlag(
        "ENABLE_ENHANCED_EXTRACTION",
      );
      const useAiAssisted = consecutiveNoFileIterations >= maxNoFileRetries;

      const extraction = await smartExtractFiles(output, {
        client: useAiAssisted ? client : undefined,
        previousAttempts: consecutiveNoFileIterations,
        strategy: useEnhancedExtraction
          ? recoveryOrchestrator?.getRecommendedTier(
              reliabilityData.stuckSignals || [],
            ) === "simplified_prompt"
            ? "ai-single-file"
            : undefined
          : undefined,
      });

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
          // Before giving up, attempt recovery if enabled
          if (recoveryOrchestrator && useRecovery) {
            await onEvent({
              type: "thinking",
              content: `Attempting recovery (tier escalation)...`,
              timestamp: new Date(),
            });

            // Publish recovery started event
            if (
              options.userId &&
              options.taskId &&
              options.taskTitle &&
              options.repoName
            ) {
              const recoveryStartedEvent = createRecoveryEvent(
                "recovery_started",
                options.taskId,
                options.taskTitle,
                options.repoName,
                "format_guidance",
                1,
                4,
                new Date(),
                { statusText: "Starting recovery process..." },
              );
              await publishRecoveryEvent(options.userId, recoveryStartedEvent);
            }

            const recoveryResult = await recoveryOrchestrator.attemptRecovery(
              {
                tier: "format_guidance",
                attemptNumber: 1,
                maxAttempts: 4,
                previousErrors: [],
                signals: reliabilityData.stuckSignals || [],
                taskDescription: context.project,
                planContent: context.planContent,
              },
              {
                taskDescription: context.project,
                planContent: context.planContent || "",
                workingDir: context.workingDir,
              },
              client,
            );

            // Track recovery attempt
            if (!reliabilityData.recoveryAttempts) {
              reliabilityData.recoveryAttempts = [];
            }
            reliabilityData.recoveryAttempts.push({
              tier: recoveryResult.tier,
              success: recoveryResult.success,
              iteration,
            });

            if (recoveryResult.success) {
              await onEvent({
                type: "thinking",
                content: `Recovery succeeded at tier: ${recoveryResult.tier}`,
                timestamp: new Date(),
              });

              // Publish recovery success event
              if (
                options.userId &&
                options.taskId &&
                options.taskTitle &&
                options.repoName
              ) {
                const recoverySuccessEvent = createRecoveryEvent(
                  "recovery_success",
                  options.taskId,
                  options.taskTitle,
                  options.repoName,
                  recoveryResult.tier,
                  1,
                  4,
                  new Date(),
                  { statusText: "Recovery successful" },
                );
                await publishRecoveryEvent(
                  options.userId,
                  recoverySuccessEvent,
                );
              }

              // Reset counter and continue loop
              consecutiveNoFileIterations = 0;
              continue;
            } else {
              await onEvent({
                type: "stuck",
                content: `Recovery exhausted. ${recoveryResult.message}`,
                metadata: {
                  manualSteps: recoveryResult.manualSteps,
                  reliabilityData,
                },
                timestamp: new Date(),
              });

              // Publish recovery failed event
              if (
                options.userId &&
                options.taskId &&
                options.taskTitle &&
                options.repoName
              ) {
                const recoveryFailedEvent = createRecoveryEvent(
                  "recovery_failed",
                  options.taskId,
                  options.taskTitle,
                  options.repoName,
                  recoveryResult.tier,
                  1,
                  4,
                  new Date(),
                  {
                    statusText: "Recovery failed",
                    error: recoveryResult.message,
                  },
                );
                await publishRecoveryEvent(options.userId, recoveryFailedEvent);
              }

              return {
                status: "stuck",
                iterations: iteration,
                commits,
                error: `No extractable code after recovery attempts. ${recoveryResult.message}`,
              };
            }
          }

          // No recovery enabled or recovery failed
          await onEvent({
            type: "stuck",
            content: `No extractable code after ${consecutiveNoFileIterations} attempts. Agent may not be producing code in a parseable format.`,
            metadata: {
              outputLength: output.length,
              warnings: extraction.warnings,
              reliabilityData,
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
        // Validate completion
        const validation = await completionValidator.validate({
          output,
          commits,
          plan: context.planContent || "",
          workingDir: context.workingDir,
          aiClient: useCompletionValidation ? client : undefined,
        });

        reliabilityData.validationReport = validation;

        if (!validation.passed) {
          await onEvent({
            type: "stuck",
            content: `Completion validation failed (score: ${validation.score}): ${validation.failures.join("; ")}`,
            metadata: {
              validation,
              reliabilityData,
            },
            timestamp: new Date(),
          });

          return {
            status: "stuck",
            iterations: iteration,
            commits,
            error: `Incomplete implementation: ${validation.failures[0]}`,
          };
        }

        await onEvent({
          type: "complete",
          content: `All tasks completed successfully (${commits.length} commit(s), validation score: ${validation.score})`,
          metadata: {
            validation,
            reliabilityData,
          },
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

      // Analyze with stuck detector
      const signals = stuckDetector.analyze({
        iteration,
        error: errorMessage,
        output: "",
        commits: 0,
        extractionSuccess: false,
        timestamp: new Date(),
      });

      reliabilityData.stuckSignals = signals;

      const isStuck = stuckDetector.isStuck(signals);
      if (isStuck) {
        const report = stuckDetector.generateReport(signals);

        await onEvent({
          type: "stuck",
          content: report.summary,
          metadata: {
            report,
            reliabilityData,
          },
          timestamp: new Date(),
        });

        return {
          status: "stuck",
          iterations: iteration,
          commits,
          error: report.summary,
        };
      }

      // Legacy fallback
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
