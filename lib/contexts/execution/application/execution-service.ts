/**
 * Execution Service (Application Layer)
 *
 * Orchestrates execution operations and coordinates with infrastructure.
 * Public API for AI Execution bounded context.
 */

import type { Redis } from "ioredis";
import { ExecutionRepository } from "../infrastructure/execution-repository";
import { ExecutionAggregate } from "../domain/execution-aggregate";
import type {
  ExecutionConfiguration,
  ExtractionResult,
  ExtractionStrategy,
  CommitInfo,
  StuckSignal,
  RecoveryAttempt,
  ValidationReport,
} from "../domain/types";
import { randomUUID } from "crypto";
import type { AIClient } from "@/lib/ai/client";
import type { ParallelExecutionOptions } from "@/lib/agents/types";
import type { ExecutionEvent } from "@/lib/ralph/types";
import {
  ExecutionAdapter,
  type ExecutionApiResponse,
  type ExecutionDetailedApiResponse,
} from "../api/adapters";

/**
 * Execution service
 */
export class ExecutionService {
  private executionRepository: ExecutionRepository;

  constructor(redis: Redis) {
    this.executionRepository = new ExecutionRepository(redis);
  }

  /**
   * Start a new execution
   */
  async startExecution(params: {
    taskId: string;
    branchName: string;
    configuration?: Partial<ExecutionConfiguration>;
  }): Promise<{ executionId: string }> {
    const executionId = randomUUID();

    // Create execution aggregate
    const execution = await ExecutionAggregate.start(
      {
        id: executionId,
        taskId: params.taskId,
        branchName: params.branchName,
        configuration: params.configuration,
      },
      this.executionRepository["redis"],
    );

    // Persist
    await this.executionRepository.save(execution);

    return { executionId };
  }

  /**
   * Start new iteration
   */
  async startIteration(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.startIteration();
    await this.executionRepository.save(execution);
  }

  /**
   * Record iteration completion
   */
  async completeIteration(params: {
    executionId: string;
    thoughts: string[];
    actions: string[];
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.completeIteration({
      thoughts: params.thoughts,
      actions: params.actions,
    });

    await this.executionRepository.save(execution);
  }

  /**
   * Record file extraction
   */
  async recordExtraction(params: {
    executionId: string;
    result: ExtractionResult;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.recordExtraction(params.result);
    await this.executionRepository.save(execution);
  }

  /**
   * Record commit
   */
  async recordCommit(params: {
    executionId: string;
    commit: CommitInfo;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.recordCommit(params.commit);
    await this.executionRepository.save(execution);
  }

  /**
   * Detect stuck signal
   */
  async detectStuckSignal(params: {
    executionId: string;
    signal: StuckSignal;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.detectStuckSignal(params.signal);
    await this.executionRepository.save(execution);
  }

  /**
   * Start recovery
   */
  async startRecovery(params: {
    executionId: string;
    attempt: RecoveryAttempt;
    reason: string;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.startRecovery(params.attempt, params.reason);
    await this.executionRepository.save(execution);
  }

  /**
   * Complete recovery
   */
  async completeRecovery(params: {
    executionId: string;
    succeeded: boolean;
    error?: string;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.completeRecovery(params.succeeded, params.error);
    await this.executionRepository.save(execution);
  }

  /**
   * Validate completion
   */
  async validateCompletion(params: {
    executionId: string;
    report: ValidationReport;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.validateCompletion(params.report);
    await this.executionRepository.save(execution);
  }

  /**
   * Record skill invocation
   */
  async recordSkill(params: {
    executionId: string;
    skillName: string;
    phase: string;
    result: "passed" | "warning" | "blocked";
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.recordSkill({
      skillName: params.skillName,
      phase: params.phase,
      result: params.result,
    });

    await this.executionRepository.save(execution);
  }

  /**
   * Complete execution
   */
  async completeExecution(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    await execution.complete();
    await this.executionRepository.save(execution);
  }

  /**
   * Fail execution
   */
  async failExecution(params: {
    executionId: string;
    error: string;
  }): Promise<void> {
    const execution = await this.executionRepository.findById(
      params.executionId,
    );
    if (!execution) {
      throw new Error(`Execution ${params.executionId} not found`);
    }

    await execution.fail(params.error);
    await this.executionRepository.save(execution);
  }

  /**
   * Get execution
   */
  async getExecution(executionId: string): Promise<{
    id: string;
    taskId: string;
    status: string;
    branchName: string;
    currentIteration: number;
    commitCount: number;
    isComplete: boolean;
  } | null> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return null;
    }

    const state = execution.getState();
    return {
      id: state.id,
      taskId: state.taskId,
      status: state.status,
      branchName: state.branchName,
      currentIteration: state.currentIteration,
      commitCount: state.commits.length,
      isComplete: execution.isComplete(),
    };
  }

  /**
   * Execute a task (replaces runLoop)
   *
   * High-level orchestration method that runs the complete Ralph loop
   * with event publishing through the ExecutionAggregate.
   */
  async executeTask(params: {
    taskId: string;
    userId: string;
    repoId: string;
    repoPath: string;
    plan: string;
    branchName: string;
    aiClient: AIClient; // AIClient from @/lib/ai/client
    mode?: "classic" | "multi-agent";
    maxIterations?: number;
    stuckThreshold?: number;
    taskTitle?: string;
    repoName?: string;
    parallelOptions?: Partial<ParallelExecutionOptions>;
    onEvent?: (event: ExecutionEvent) => void | Promise<void>;
    onProgress?: (event: ExecutionEvent) => void | Promise<void>;
  }): Promise<{
    status: "complete" | "stuck" | "continue";
    iterations: number;
    commits: string[];
    error?: string;
  }> {
    const {
      taskId,
      repoPath,
      plan,
      branchName,
      aiClient,
      mode = "classic",
      maxIterations = 50,
      stuckThreshold = 3,
      taskTitle = "",
      repoName = "",
      parallelOptions,
      onEvent,
      onProgress,
    } = params;

    // Start execution and get ID
    const { executionId } = await this.startExecution({
      taskId,
      branchName,
      configuration: {
        maxIterations,
      },
    });

    try {
      // Route to appropriate execution mode
      if (mode === "multi-agent" && plan) {
        return await this.executeMultiAgent({
          executionId,
          taskId,
          repoPath,
          plan,
          aiClient,
          parallelOptions,
          onEvent,
          onProgress,
        });
      } else {
        return await this.executeClassic({
          executionId,
          taskId,
          repoPath,
          plan,
          branchName,
          aiClient,
          maxIterations,
          stuckThreshold,
          taskTitle,
          repoName,
          onEvent,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.failExecution({ executionId, error: errorMessage });

      return {
        status: "stuck",
        iterations: 0,
        commits: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Execute in multi-agent mode
   */
  private async executeMultiAgent(params: {
    executionId: string;
    taskId: string;
    repoPath: string;
    plan: string;
    aiClient: AIClient;
    parallelOptions?: Partial<ParallelExecutionOptions>;
    onEvent?: (event: ExecutionEvent) => void | Promise<void>;
    onProgress?: (event: ExecutionEvent) => void | Promise<void>;
  }): Promise<{
    status: "complete" | "stuck" | "continue";
    iterations: number;
    commits: string[];
    error?: string;
  }> {
    const { runParallelExecution } =
      await import("@/lib/ralph/parallel-executor");

    try {
      const result = await runParallelExecution(
        {
          workingDir: params.repoPath,
          project: params.taskId,
          changeId: params.taskId,
          planContent: params.plan,
        },
        {
          client: params.aiClient,
          options: params.parallelOptions,
          onEvent: async (event) => {
            // Map events to aggregate methods
            if (event.type === "commit" && event.metadata?.commitSha) {
              await this.recordCommit({
                executionId: params.executionId,
                commit: {
                  hash: event.metadata.commitSha,
                  message: event.content,
                  filesChanged: event.metadata.filesChanged || 0,
                  linesAdded: 0,
                  linesDeleted: 0,
                  timestamp: event.timestamp,
                },
              });
            }

            // Also call worker's onEvent callback if provided
            if (params.onEvent) {
              await params.onEvent(event);
            }
          },
          onProgress: params.onProgress,
        },
      );

      if (result.success) {
        await this.completeExecution(params.executionId);
      } else {
        await this.failExecution({
          executionId: params.executionId,
          error: result.error || "Multi-agent execution failed",
        });
      }

      return {
        status: result.success ? "complete" : "stuck",
        iterations: result.taskResults.size,
        commits: result.commits,
        error: result.error,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.failExecution({
        executionId: params.executionId,
        error: errorMessage,
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
   * Execute in classic single-agent mode
   */
  private async executeClassic(params: {
    executionId: string;
    taskId: string;
    repoPath: string;
    plan: string;
    branchName: string;
    aiClient: AIClient;
    maxIterations: number;
    stuckThreshold: number;
    taskTitle: string;
    repoName: string;
    onEvent?: (event: ExecutionEvent) => void | Promise<void>;
  }): Promise<{
    status: "complete" | "stuck" | "continue";
    iterations: number;
    commits: string[];
    error?: string;
  }> {
    // Import dependencies
    const { generatePrompt } = await import("@/lib/ralph/prompt-generator");
    const { smartExtractFiles, getFormatInstructions } =
      await import("@/lib/ralph/smart-extractor");
    const { applyFileChanges } = await import("@/lib/ralph/file-writer");
    const { commitChanges } = await import("@/lib/ralph/git-operations");
    const { StuckDetector, LegacyStuckChecker } =
      await import("@/lib/ralph/stuck-detector");
    const { RecoveryOrchestrator } =
      await import("@/lib/ralph/recovery-strategies");
    const { CompletionValidator, LegacyCompletionChecker } =
      await import("@/lib/ralph/completion-validator");
    const { getFeatureFlag } = await import("@/lib/config/feature-flags");
    const { RALPH_COMPLETE, RALPH_STUCK } = await import("@/lib/ralph/types");

    const commits: string[] = [];
    let iteration = 1;
    let stuckCount = 0;
    let consecutiveNoFileIterations = 0;
    const maxNoFileRetries = 2;

    // Initialize reliability modules
    const useStuckDetector = getFeatureFlag("ENABLE_STUCK_DETECTOR");
    const useRecovery = getFeatureFlag("ENABLE_RECOVERY_STRATEGIES");
    const useCompletionValidation = getFeatureFlag(
      "ENABLE_COMPLETION_VALIDATION",
    );

    const stuckDetector = useStuckDetector
      ? new StuckDetector({
          maxConsecutiveErrors: params.stuckThreshold,
          iterationTimeoutMinutes: 10,
          progressCommitThreshold: 3,
        })
      : new LegacyStuckChecker(params.stuckThreshold);

    const recoveryOrchestrator = useRecovery
      ? new RecoveryOrchestrator()
      : null;
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
      validationReport?: ValidationReport;
    } = {};

    // Helper to check completion markers
    const checkCompletion = (
      output: string,
    ): "complete" | "stuck" | "continue" => {
      if (output.includes(RALPH_COMPLETE)) return "complete";
      if (output.includes(RALPH_STUCK)) return "stuck";
      return "continue";
    };

    const extractStuckReason = (output: string): string | undefined => {
      const match = output.match(/RALPH_STUCK:\s*(.+)/);
      return match ? match[1].trim() : undefined;
    };

    // Helper to emit events
    const emitEvent = async (event: ExecutionEvent) => {
      if (params.onEvent) {
        await params.onEvent(event);
      }
    };

    // Main execution loop
    while (iteration <= params.maxIterations) {
      await this.startIteration(params.executionId);

      // Emit thinking event
      await emitEvent({
        type: "thinking",
        content: `Starting iteration ${iteration} (using ${params.aiClient.getProvider()}/${params.aiClient.getModel()})`,
        timestamp: new Date(),
        metadata: { iteration },
      });

      // Skills Framework Integration
      const skillsEnabled = process.env.ENABLE_SKILLS_SYSTEM !== "false";
      let skillResults: Array<{ skillId: string; status: string }> = [];

      if (skillsEnabled) {
        try {
          const { invokePhaseSkills, isSkillsSystemEnabled } =
            await import("@/lib/skills");

          if (isSkillsSystemEnabled()) {
            const skillContext = {
              taskId: params.taskId,
              phase: "executing" as const,
              taskDescription: params.taskTitle,
              workingDir: params.repoPath,
              iteration,
              modifiedFiles: [],
              commits: [],
              executionId: params.executionId,
            };

            skillResults = await invokePhaseSkills(
              "executing",
              skillContext,
              params.aiClient,
            );

            // Record skills
            for (const result of skillResults) {
              await this.recordSkill({
                executionId: params.executionId,
                skillName: result.skillId,
                phase: "executing",
                result: result.status as "complete" | "stuck" | "continue",
              });
            }

            // Emit skills event
            if (skillResults.length > 0) {
              await emitEvent({
                type: "thinking",
                content: `Skills executed: ${skillResults.map((r) => `${r.skillId}(${r.status})`).join(", ")}`,
                timestamp: new Date(),
                metadata: { iteration },
              });
            }
          }
        } catch (error) {
          // Skills framework optional
          console.warn(
            "[ExecutionService] Skills framework not available:",
            error,
          );
        }
      }

      // Generate prompt
      let prompt = generatePrompt({
        project: params.taskTitle,
        changeId: params.taskId,
        iteration,
        workingDir: params.repoPath,
        tasksPath: params.plan,
        quickVerify: "",
        fullVerify: "",
        doConstraints: [],
        dontConstraints: [],
      });

      // Apply skill-augmented prompts (skip for now - skills return different format)
      // TODO: Properly integrate skill augmented prompts in Phase 9

      // Add format instructions if needed
      if (consecutiveNoFileIterations > 0) {
        prompt = `${getFormatInstructions()}\n\n${prompt}`;

        await emitEvent({
          type: "thinking",
          content: `Added format instructions due to ${consecutiveNoFileIterations} iteration(s) without extractable code`,
          timestamp: new Date(),
          metadata: { iteration },
        });
      }

      try {
        // Call AI client
        const output = await params.aiClient.chat(
          [{ role: "user", content: prompt }],
          {
            maxTokens: 8192,
          },
        );

        await emitEvent({
          type: "thinking",
          content: `Iteration ${iteration} completed`,
          metadata: { output: output.substring(0, 500), iteration },
          timestamp: new Date(),
        });

        // Extract files
        const useEnhancedExtraction = getFeatureFlag(
          "ENABLE_ENHANCED_EXTRACTION",
        );
        const useAiAssisted = consecutiveNoFileIterations >= maxNoFileRetries;

        const extraction = await smartExtractFiles(output, {
          client: useAiAssisted ? params.aiClient : undefined,
          previousAttempts: consecutiveNoFileIterations,
          strategy: useEnhancedExtraction
            ? recoveryOrchestrator?.getRecommendedTier(
                reliabilityData.stuckSignals || [],
              ) === "simplified_prompt"
              ? "ai-single-file"
              : undefined
            : undefined,
        });

        // Record extraction
        await this.recordExtraction({
          executionId: params.executionId,
          result: {
            files: extraction.files.map(
              (f: { path: string; content: string; action?: string }) => ({
                path: f.path,
                content: f.content,
                language: f.language,
              }),
            ),
            strategy: (extraction.method || "strict") as ExtractionStrategy,
            confidence: extraction.confidence,
            fallbackUsed: false,
          },
        });

        await emitEvent({
          type: "thinking",
          content: `Extraction: ${extraction.files.length} file(s) via ${extraction.method}`,
          metadata: {
            method: extraction.method,
            fileCount: extraction.files.length,
            warnings: extraction.warnings,
            iteration,
          },
          timestamp: new Date(),
        });

        if (extraction.files.length === 0) {
          consecutiveNoFileIterations++;

          if (consecutiveNoFileIterations > maxNoFileRetries) {
            // Attempt recovery
            if (recoveryOrchestrator && useRecovery) {
              await emitEvent({
                type: "thinking",
                content: "Attempting recovery (tier escalation)...",
                timestamp: new Date(),
                metadata: { iteration },
              });

              await this.startRecovery({
                executionId: params.executionId,
                attempt: {
                  tier: 1,
                  strategy: "format_guidance",
                  startedAt: new Date(),
                  succeeded: false,
                },
                reason: "No extractable code",
              });

              const recoveryResult = await recoveryOrchestrator.attemptRecovery(
                {
                  tier: "format_guidance",
                  attemptNumber: 1,
                  maxAttempts: 4,
                  previousErrors: [],
                  signals: reliabilityData.stuckSignals || [],
                  taskDescription: params.taskTitle,
                  planContent: params.plan,
                },
                {
                  taskDescription: params.taskTitle,
                  planContent: params.plan || "",
                  workingDir: params.repoPath,
                },
                params.aiClient,
              );

              if (!reliabilityData.recoveryAttempts) {
                reliabilityData.recoveryAttempts = [];
              }
              reliabilityData.recoveryAttempts.push({
                tier: recoveryResult.tier,
                success: recoveryResult.success,
                iteration,
              });

              await this.completeRecovery({
                executionId: params.executionId,
                succeeded: recoveryResult.success,
                error: recoveryResult.success
                  ? undefined
                  : recoveryResult.message,
              });

              if (recoveryResult.success) {
                await emitEvent({
                  type: "thinking",
                  content: `Recovery succeeded at tier: ${recoveryResult.tier}`,
                  timestamp: new Date(),
                  metadata: { iteration },
                });

                consecutiveNoFileIterations = 0;
                continue;
              } else {
                await emitEvent({
                  type: "stuck",
                  content: `Recovery exhausted. ${recoveryResult.message}`,
                  metadata: {
                    manualSteps: recoveryResult.manualSteps,
                    reliabilityData,
                    iteration,
                  },
                  timestamp: new Date(),
                });
                await this.failExecution({
                  executionId: params.executionId,
                  error: `No extractable code after recovery attempts. ${recoveryResult.message}`,
                });

                return {
                  status: "stuck",
                  iterations: iteration,
                  commits,
                  error: `No extractable code after recovery attempts. ${recoveryResult.message}`,
                };
              }
            }

            // No recovery or recovery failed
            const status = checkCompletion(output);
            if (status === "complete") {
              await this.failExecution({
                executionId: params.executionId,
                error: "Agent reported completion but no code was extracted",
              });

              return {
                status: "stuck",
                iterations: iteration,
                commits,
                error: "Agent reported completion but no code was extracted",
              };
            }
          }
        } else {
          // Successfully extracted files
          consecutiveNoFileIterations = 0;

          await emitEvent({
            type: "file_write",
            content: `Writing ${extraction.files.length} file(s): ${extraction.files.map((f: { path: string; content: string; action?: string }) => f.path).join(", ")}`,
            metadata: {
              files: extraction.files.map(
                (f: { path: string; content: string; action?: string }) =>
                  f.path,
              ),
              method: extraction.method,
              iteration,
            },
            timestamp: new Date(),
          });

          // Write files
          const writeResult = await applyFileChanges(
            params.repoPath,
            extraction.files.map(
              (f: { path: string; content: string; action?: string }) => ({
                path: f.path,
                action: f.action,
                content: f.content,
              }),
            ),
          );

          if (writeResult.errors.length > 0) {
            await emitEvent({
              type: "error",
              content: `File write errors: ${writeResult.errors.map((e: { path: string; error: string }) => `${e.path}: ${e.error}`).join("; ")}`,
              timestamp: new Date(),
              metadata: { iteration },
            });
          }

          if (writeResult.writtenFiles.length > 0) {
            // Commit changes
            try {
              const commitResult = await commitChanges(
                params.repoPath,
                `feat: iteration ${iteration} changes`,
                writeResult.writtenFiles,
              );
              commits.push(commitResult.sha);

              // Record commit via aggregate
              await this.recordCommit({
                executionId: params.executionId,
                commit: {
                  hash: commitResult.sha,
                  message: `feat: iteration ${iteration} changes`,
                  filesChanged: commitResult.filesChanged,
                  linesAdded: 0,
                  linesDeleted: 0,
                  timestamp: new Date(),
                },
              });

              await emitEvent({
                type: "commit",
                content: `Committed ${commitResult.filesChanged} file(s)`,
                metadata: {
                  commitSha: commitResult.sha,
                  filesChanged: commitResult.filesChanged,
                  iteration,
                },
                timestamp: new Date(),
              });
            } catch (commitError) {
              // Continue even if commit fails
              console.error("[ExecutionService] Commit failed:", commitError);

              await emitEvent({
                type: "error",
                content: `Commit failed: ${commitError instanceof Error ? commitError.message : "Unknown error"}`,
                timestamp: new Date(),
                metadata: { iteration },
              });
            }
          }
        }

        // Complete iteration
        await this.completeIteration({
          executionId: params.executionId,
          thoughts: [output.substring(0, 500)],
          actions: extraction.files.map(
            (f: { path: string; content: string; action?: string }) =>
              `${f.action} ${f.path}`,
          ),
        });

        // Check completion status
        const status = checkCompletion(output);

        if (status === "complete") {
          // Validate completion
          const validation = await completionValidator.validate({
            output,
            commits,
            plan: params.plan || "",
            workingDir: params.repoPath,
            aiClient: useCompletionValidation ? params.aiClient : undefined,
          });

          reliabilityData.validationReport = validation;

          await this.validateCompletion({
            executionId: params.executionId,
            report: {
              score: validation.score,
              passed: validation.passed,
              checks: {
                hasMarker: {
                  passed: validation.checks?.hasMarker ?? false,
                  score: 0,
                  weight: 20,
                },
                hasCommits: {
                  passed: validation.checks?.hasCommits ?? false,
                  score: 0,
                  weight: 20,
                },
                matchesPlan: {
                  passed: validation.checks?.matchesPlan ?? false,
                  score: 0,
                  weight: 30,
                },
                qualityThreshold: {
                  passed: validation.checks?.qualityThreshold ?? false,
                  score: 0,
                  weight: 15,
                },
                testsExecuted: {
                  passed: validation.checks?.testsExecuted ?? false,
                  score: 0,
                  weight: 5,
                },
                noCriticalErrors: {
                  passed: validation.checks?.noCriticalErrors ?? false,
                  score: 0,
                  weight: 10,
                },
              },
              generatedAt: new Date(),
            },
          });

          if (!validation.passed) {
            await emitEvent({
              type: "stuck",
              content: `Completion validation failed (score: ${validation.score}): ${validation.failures.join("; ")}`,
              metadata: {
                validation,
                reliabilityData,
                iteration,
              },
              timestamp: new Date(),
            });

            await this.failExecution({
              executionId: params.executionId,
              error: `Incomplete implementation: ${validation.failures[0]}`,
            });

            return {
              status: "stuck",
              iterations: iteration,
              commits,
              error: `Incomplete implementation: ${validation.failures[0]}`,
            };
          }

          await emitEvent({
            type: "complete",
            content: `All tasks completed successfully (${commits.length} commit(s), validation score: ${validation.score})`,
            metadata: {
              validation,
              reliabilityData,
              commits: commits.length,
              iteration,
            },
            timestamp: new Date(),
          });

          await this.completeExecution(params.executionId);

          return {
            status: "complete",
            iterations: iteration,
            commits,
          };
        }

        if (status === "stuck") {
          const reason = extractStuckReason(output) || "Unknown reason";

          await emitEvent({
            type: "stuck",
            content: `Stuck: ${reason}`,
            timestamp: new Date(),
            metadata: { iteration },
          });

          await this.failExecution({
            executionId: params.executionId,
            error: reason,
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

        await emitEvent({
          type: "error",
          content: `Error in iteration ${iteration}: ${errorMessage}`,
          timestamp: new Date(),
          metadata: { iteration },
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

        // Detect stuck signal
        for (const signal of signals) {
          await this.detectStuckSignal({
            executionId: params.executionId,
            signal: {
              type: signal.type,
              severity: signal.severity,
              details: {
                confidence: signal.confidence,
                evidence: signal.evidence,
                ...signal.metadata,
              },
              detectedAt: new Date(),
            },
          });
        }

        const isStuck = stuckDetector.isStuck(signals);
        if (isStuck) {
          const report = stuckDetector.generateReport(signals);

          await emitEvent({
            type: "stuck",
            content: report.summary,
            metadata: {
              report,
              reliabilityData,
              iteration,
            },
            timestamp: new Date(),
          });

          await this.failExecution({
            executionId: params.executionId,
            error: report.summary,
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
        if (stuckCount >= params.stuckThreshold) {
          await this.failExecution({
            executionId: params.executionId,
            error: `Failed after ${stuckCount} consecutive errors: ${errorMessage}`,
          });

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
    await emitEvent({
      type: "stuck",
      content: `Max iterations (${params.maxIterations}) reached`,
      timestamp: new Date(),
      metadata: { iteration },
    });

    await this.failExecution({
      executionId: params.executionId,
      error: `Max iterations (${params.maxIterations}) reached`,
    });

    return {
      status: "stuck",
      iterations: iteration,
      commits,
      error: `Max iterations (${params.maxIterations}) reached`,
    };
  }

  /**
   * Get full execution state in API format
   *
   * Returns complete execution information formatted for API responses.
   * Uses ExecutionAdapter to transform domain state to API format.
   */
  async getExecutionFull(
    executionId: string,
  ): Promise<ExecutionApiResponse | null> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return null;
    }

    const state = execution.getState();

    // Use adapter to transform to API format (basic)
    return ExecutionAdapter.toApiResponse(state);
  }

  /**
   * Get detailed execution state in API format
   *
   * Returns complete execution with full iteration history and commit details.
   * Uses ExecutionAdapter to transform domain state to detailed API format.
   */
  async getExecutionDetailed(
    executionId: string,
  ): Promise<ExecutionDetailedApiResponse | null> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return null;
    }

    const state = execution.getState();

    // Use adapter to transform to detailed API format
    return ExecutionAdapter.toDetailedApiResponse(state);
  }
}
