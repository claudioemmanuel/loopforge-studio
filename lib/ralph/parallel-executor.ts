/**
 * Parallel Executor - Executes tasks concurrently respecting dependencies
 */

import type {
  AgentResult,
  DependencyGraph,
  ExecutionProgress,
  ParallelExecutionOptions,
  ParallelExecutionResult,
  ReviewResult,
  TaskNode,
  AgentExecutionContext,
} from "@/lib/agents/types";
import type { AIClient } from "@/lib/ai/client";
import type { ExecutionEvent } from "./types";
import {
  buildDependencyGraph,
  validateGraph,
  getReadyTasks,
  markTaskRunning,
  markTaskCompleted,
  markTaskFailed,
  skipDependentTasks,
  hasIncompleteTasks,
  getProgress,
  parsePlan,
} from "./dependency-graph";
import { executeTask } from "@/lib/agents/executor";
import { executeReview } from "./review-gate";
import { routeTaskToAgent } from "@/lib/agents/router";
import { parseFileChanges, applyFileChanges } from "./file-writer";
import { commitChanges } from "./git-operations";

const DEFAULT_OPTIONS: ParallelExecutionOptions = {
  maxConcurrency: 3,
  retryOnFailure: true,
  stopOnCriticalFailure: true,
  mandatoryReview: true,
  maxRetries: 1,
};

interface ParallelExecutorOptions {
  /** AI client for agent execution */
  client: AIClient;
  /** Parallel execution options */
  options?: Partial<ParallelExecutionOptions>;
  /** Callback for execution events */
  onEvent: (event: ExecutionEvent) => void | Promise<void>;
  /** Callback for progress updates */
  onProgress?: (progress: ExecutionProgress) => void | Promise<void>;
}

interface ExecutorContext {
  /** Working directory */
  workingDir: string;
  /** Project name */
  project: string;
  /** Change/task ID */
  changeId: string;
  /** Full plan content */
  planContent: string;
}

/**
 * Execute tasks in parallel respecting dependencies
 */
export async function runParallelExecution(
  context: ExecutorContext,
  executorOptions: ParallelExecutorOptions,
): Promise<ParallelExecutionResult> {
  const { client, onEvent, onProgress } = executorOptions;
  const options = { ...DEFAULT_OPTIONS, ...executorOptions.options };
  const startTime = Date.now();

  // Parse the plan
  const plan = parsePlan(context.planContent);

  await onEvent({
    type: "thinking",
    content: `Parsed plan with ${plan.steps.length} steps`,
    timestamp: new Date(),
  });

  // Build and validate dependency graph
  const graph = buildDependencyGraph(plan.steps);
  const validation = validateGraph(graph);

  if (!validation.valid) {
    await onEvent({
      type: "error",
      content: `Invalid dependency graph: ${validation.error}`,
      timestamp: new Date(),
    });

    return {
      success: false,
      taskResults: new Map(),
      reviewResults: new Map(),
      commits: [],
      totalDurationMs: Date.now() - startTime,
      error: validation.error,
    };
  }

  await onEvent({
    type: "thinking",
    content: `Dependency graph validated. Root tasks: ${graph.roots.join(", ")}`,
    timestamp: new Date(),
  });

  // Track results
  const taskResults = new Map<string, AgentResult>();
  const reviewResults = new Map<string, ReviewResult>();
  const commits: string[] = [];
  const retryCount = new Map<string, number>();
  let iteration = 0;

  // Execution loop
  while (hasIncompleteTasks(graph)) {
    iteration++;
    const readyTasks = getReadyTasks(graph);

    if (readyTasks.length === 0) {
      // No tasks ready but still incomplete - might be stuck
      const progress = getProgress(graph);
      if (progress.running === 0 && progress.pending > 0) {
        await onEvent({
          type: "stuck",
          content: "No tasks ready to execute but pending tasks remain",
          timestamp: new Date(),
        });
        break;
      }
      // Wait a bit and continue (tasks might be running)
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }

    // Limit concurrency
    const tasksToRun = readyTasks.slice(0, options.maxConcurrency);

    await onEvent({
      type: "thinking",
      content: `Iteration ${iteration}: Starting ${tasksToRun.length} parallel tasks: ${tasksToRun.map((t) => t.step.title).join(", ")}`,
      metadata: { iteration },
      timestamp: new Date(),
    });

    // Mark tasks as running
    for (const task of tasksToRun) {
      markTaskRunning(graph, task.id);
    }

    // Report progress
    const progress = getProgress(graph);
    await onProgress?.({
      total: progress.total,
      completed: progress.completed,
      failed: progress.failed,
      running: progress.running,
      pending: progress.pending,
      currentTasks: tasksToRun.map((t) => t.id),
      progressPercent: progress.progressPercent,
    });

    // Execute tasks in parallel
    const executionPromises = tasksToRun.map((taskNode) =>
      executeTaskWithReview(taskNode, graph, context, client, options, onEvent),
    );

    const results = await Promise.all(executionPromises);

    // Process results
    for (let i = 0; i < results.length; i++) {
      const taskNode = tasksToRun[i];
      const { agentResult, reviewResult, commit } = results[i];

      taskResults.set(taskNode.id, agentResult);
      if (reviewResult) {
        reviewResults.set(taskNode.id, reviewResult);
      }

      if (agentResult.success && reviewResult?.passed) {
        // Success - mark completed
        markTaskCompleted(graph, taskNode.id);
        taskNode.result = agentResult;
        taskNode.reviewResult = reviewResult;

        if (commit) {
          commits.push(commit);
        }

        await onEvent({
          type: "complete",
          content: `Task "${taskNode.step.title}" completed`,
          timestamp: new Date(),
        });
      } else if (
        options.retryOnFailure &&
        (retryCount.get(taskNode.id) || 0) < options.maxRetries
      ) {
        // Retry
        retryCount.set(taskNode.id, (retryCount.get(taskNode.id) || 0) + 1);
        taskNode.status = "pending"; // Reset for retry

        await onEvent({
          type: "thinking",
          content: `Task "${taskNode.step.title}" failed, retrying... (attempt ${retryCount.get(taskNode.id)})`,
          timestamp: new Date(),
        });
      } else {
        // Failed
        markTaskFailed(graph, taskNode.id);
        taskNode.result = agentResult;

        const reason =
          agentResult.error || reviewResult?.feedback || "Unknown failure";
        await onEvent({
          type: "error",
          content: `Task "${taskNode.step.title}" failed: ${reason}`,
          timestamp: new Date(),
        });

        // Skip dependent tasks
        const skipped = skipDependentTasks(graph, taskNode.id);
        if (skipped.length > 0) {
          await onEvent({
            type: "thinking",
            content: `Skipping dependent tasks: ${skipped.join(", ")}`,
            timestamp: new Date(),
          });
        }

        // Check if this is a critical failure
        if (options.stopOnCriticalFailure && isCriticalTask(taskNode)) {
          await onEvent({
            type: "stuck",
            content: `Critical task failed, stopping execution`,
            timestamp: new Date(),
          });

          return {
            success: false,
            taskResults,
            reviewResults,
            commits,
            totalDurationMs: Date.now() - startTime,
            error: `Critical task "${taskNode.step.title}" failed: ${reason}`,
          };
        }
      }
    }
  }

  // Final status
  const finalProgress = getProgress(graph);
  const success =
    finalProgress.failed === 0 &&
    finalProgress.completed === finalProgress.total;

  await onEvent({
    type: success ? "complete" : "stuck",
    content: success
      ? `All ${finalProgress.completed} tasks completed successfully`
      : `Execution finished: ${finalProgress.completed} completed, ${finalProgress.failed} failed, ${finalProgress.skipped} skipped`,
    timestamp: new Date(),
  });

  return {
    success,
    taskResults,
    reviewResults,
    commits,
    totalDurationMs: Date.now() - startTime,
    error: success ? undefined : `${finalProgress.failed} tasks failed`,
  };
}

/**
 * Execute a single task with code review
 */
async function executeTaskWithReview(
  taskNode: TaskNode,
  graph: DependencyGraph,
  context: ExecutorContext,
  client: AIClient,
  options: ParallelExecutionOptions,
  onEvent: (event: ExecutionEvent) => void | Promise<void>,
): Promise<{
  agentResult: AgentResult;
  reviewResult?: ReviewResult;
  commit?: string;
}> {
  const routing = routeTaskToAgent(taskNode.step);

  await onEvent({
    type: "thinking",
    content: `Executing "${taskNode.step.title}" with ${routing.agent.name}`,
    timestamp: new Date(),
  });

  // Build execution context
  const execContext: Omit<AgentExecutionContext, "task"> = {
    workingDir: context.workingDir,
    project: context.project,
    changeId: context.changeId,
    iteration: 1,
    planContent: context.planContent,
  };

  // Execute the task
  const agentResult = await executeTask(taskNode.step, execContext, {
    client,
    onProgress: async (msg) => {
      await onEvent({
        type: "thinking",
        content: msg,
        timestamp: new Date(),
      });
    },
  });

  if (!agentResult.success) {
    return { agentResult };
  }

  // Mandatory code review
  if (options.mandatoryReview) {
    await onEvent({
      type: "thinking",
      content: `Reviewing changes from "${taskNode.step.title}"`,
      timestamp: new Date(),
    });

    const reviewResult = await executeReview(
      {
        taskTitle: taskNode.step.title,
        changes: agentResult.output,
        modifiedFiles: agentResult.modifiedFiles,
      },
      {
        client,
        onProgress: async (msg) => {
          await onEvent({
            type: "thinking",
            content: msg,
            timestamp: new Date(),
          });
        },
      },
    );

    if (!reviewResult.passed) {
      await onEvent({
        type: "thinking",
        content: `Review failed: ${reviewResult.feedback}`,
        timestamp: new Date(),
      });

      return {
        agentResult: {
          ...agentResult,
          success: false,
          error: `Code review failed: ${reviewResult.feedback}`,
        },
        reviewResult,
      };
    }

    await onEvent({
      type: "thinking",
      content: `Review passed for "${taskNode.step.title}"`,
      timestamp: new Date(),
    });

    // Parse file changes from agent output and write to disk
    const fileChanges = parseFileChanges(agentResult.output);
    let commit: string | undefined;

    if (fileChanges.length === 0) {
      // Log warning when no file changes detected - helps diagnose parsing issues
      await onEvent({
        type: "thinking",
        content: `No file changes detected in agent output for "${taskNode.step.title}". The AI may not have produced code in the expected format.`,
        metadata: { outputLength: agentResult.output.length },
        timestamp: new Date(),
      });
    }

    if (fileChanges.length > 0) {
      await onEvent({
        type: "file_write",
        content: `Writing ${fileChanges.length} file(s): ${fileChanges.map((f) => f.path).join(", ")}`,
        timestamp: new Date(),
      });

      const writeResult = await applyFileChanges(
        context.workingDir,
        fileChanges,
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
            `feat(${taskNode.step.id}): ${taskNode.step.title}`,
            writeResult.writtenFiles,
          );
          commit = commitResult.sha;

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

    return { agentResult, reviewResult, commit };
  }

  return { agentResult };
}

/**
 * Determine if a task is critical (failure should stop execution)
 */
function isCriticalTask(taskNode: TaskNode): boolean {
  const title = taskNode.step.title.toLowerCase();
  const description = (taskNode.step.description || "").toLowerCase();
  const content = `${title} ${description}`;

  // Tasks with "critical", "security", "auth", etc. are considered critical
  const criticalKeywords = [
    "critical",
    "security",
    "authentication",
    "authorization",
    "database migration",
    "schema",
  ];

  return criticalKeywords.some((kw) => content.includes(kw));
}

/**
 * Get execution summary for reporting
 */
export function getExecutionSummary(result: ParallelExecutionResult): string {
  const lines: string[] = [
    `## Execution Summary`,
    ``,
    `Status: ${result.success ? "✅ Success" : "❌ Failed"}`,
    `Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`,
    `Commits: ${result.commits.length}`,
    ``,
    `### Task Results`,
  ];

  for (const [taskId, agentResult] of result.taskResults) {
    const status = agentResult.success ? "✅" : "❌";
    const review = result.reviewResults.get(taskId);
    const reviewStatus = review
      ? review.passed
        ? "✅ reviewed"
        : "❌ review failed"
      : "";

    lines.push(`- ${status} ${taskId}: ${agentResult.agentId} ${reviewStatus}`);

    if (!agentResult.success && agentResult.error) {
      lines.push(`  Error: ${agentResult.error}`);
    }
  }

  if (result.error) {
    lines.push(``, `### Error`, result.error);
  }

  return lines.join("\n");
}
