import { Job } from "bullmq";
import { db, users, tasks, executions, executionEvents, repos, workerJobs, workerEvents } from "../lib/db";
import type { WorkerEventMetadata } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { runLoop, type LoopContext, type ExecutionMode } from "../lib/ralph";
import {
  createExecutionWorker,
  createAutonomousFlowWorker,
  createBrainstormWorker,
  createPlanWorker,
  queuePlan,
  queueExecution,
  type ExecutionJobData,
  type ExecutionJobResult,
  type BrainstormJobData,
  type BrainstormJobResult,
  type PlanJobData,
  type PlanJobResult,
} from "../lib/queue";
import { decryptGithubToken } from "../lib/crypto";
import { createAIClient, brainstormTask, generatePlan, type RepoContext } from "../lib/ai";
import {
  publishWorkerEvent,
  createWorkerUpdateEvent,
  publishProcessingEvent,
  createProcessingEvent,
  phaseStatusMessages,
} from "../lib/workers/events";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";

const REPOS_DIR = process.env.REPOS_DIR || "/app/repos";

// Determine execution mode from environment or default to multi-agent
const EXECUTION_MODE: ExecutionMode = (process.env.EXECUTION_MODE as ExecutionMode) || "multi-agent";

// Database-compatible event types
type DbEventType = "thinking" | "file_read" | "file_write" | "command_run" | "commit" | "error" | "complete" | "stuck";

// Map extended event types to database-compatible types
function mapEventTypeToDb(
  eventType: string
): DbEventType {
  const mapping: Record<string, DbEventType> = {
    // Direct mappings
    thinking: "thinking",
    file_read: "file_read",
    file_write: "file_write",
    command_run: "command_run",
    commit: "commit",
    error: "error",
    complete: "complete",
    stuck: "stuck",
    // Map new event types to existing ones
    agent_start: "thinking",
    agent_complete: "thinking",
    review_start: "thinking",
    review_complete: "thinking",
    task_start: "thinking",
    task_complete: "complete",
    task_failed: "error",
  };

  return mapping[eventType] || "thinking";
}

// Worker event types for unified history
type WorkerEventTypeValue = "thinking" | "action" | "file_read" | "file_write" | "api_call" | "error" | "complete";

// Map execution event types to worker event types
function mapEventTypeToWorkerEvent(eventType: string): WorkerEventTypeValue {
  const mapping: Record<string, WorkerEventTypeValue> = {
    thinking: "thinking",
    file_read: "file_read",
    file_write: "file_write",
    command_run: "action",
    commit: "action",
    error: "error",
    complete: "complete",
    stuck: "error",
    agent_start: "thinking",
    agent_complete: "complete",
    review_start: "thinking",
    review_complete: "complete",
    task_start: "action",
    task_complete: "complete",
    task_failed: "error",
  };

  return mapping[eventType] || "action";
}

// Format event type for display in SSE stream
function formatEventAction(eventType: string, content?: string): string {
  const actionMap: Record<string, string> = {
    thinking: "Analyzing...",
    file_read: "Reading file",
    file_write: "Writing file",
    command_run: "Running command",
    commit: "Committing changes",
    error: "Error encountered",
    complete: "Completed",
    stuck: "Failed",
    agent_start: "Starting agent",
    agent_complete: "Agent finished",
    review_start: "Starting review",
    review_complete: "Review finished",
    task_start: "Starting task",
    task_complete: "Task completed",
    task_failed: "Task failed",
  };

  const action = actionMap[eventType] || "Processing...";

  // Add content snippet if available (truncate for display)
  if (content && content.length > 0) {
    const snippet = content.slice(0, 50).replace(/\n/g, " ");
    return `${action}: ${snippet}${content.length > 50 ? "..." : ""}`;
  }

  return action;
}

// Calculate execution progress based on iteration and event type
function calculateExecutionProgress(
  iteration: number,
  maxIterations: number,
  eventType: string
): number {
  // Base progress: 60% (previous phases) + up to 40% for execution
  const baseProgress = 60;
  const executionRange = 40;

  // Complete events get 100%
  if (eventType === "complete" || eventType === "task_complete") {
    return 100;
  }

  // Error/stuck events stay at current progress
  if (eventType === "error" || eventType === "stuck" || eventType === "task_failed") {
    return baseProgress + (iteration / maxIterations) * executionRange * 0.9;
  }

  // Calculate progress within execution phase (60% to 95%)
  const iterationProgress = Math.min(iteration / maxIterations, 1);
  return Math.min(baseProgress + iterationProgress * executionRange * 0.9, 95);
}

// Build authenticated clone URL with GitHub token
function buildAuthenticatedCloneUrl(cloneUrl: string, token: string): string {
  const url = new URL(cloneUrl);
  url.username = "x-access-token";
  url.password = token;
  return url.toString();
}

// Get user's decrypted GitHub token
async function getUserGithubToken(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.encryptedGithubToken || !user?.githubTokenIv) {
    return null;
  }

  try {
    return decryptGithubToken({
      encrypted: user.encryptedGithubToken,
      iv: user.githubTokenIv,
    });
  } catch (error) {
    console.error("Failed to decrypt GitHub token:", error);
    return null;
  }
}

// Clone or update repository
async function cloneOrUpdateRepo(
  cloneUrl: string,
  repoName: string,
  branch: string,
  githubToken: string | null
): Promise<string> {
  const repoPath = path.join(REPOS_DIR, repoName);

  // Use authenticated URL if token available
  const effectiveCloneUrl = githubToken
    ? buildAuthenticatedCloneUrl(cloneUrl, githubToken)
    : cloneUrl;

  // Ensure repos directory exists
  await fs.mkdir(REPOS_DIR, { recursive: true });

  const git = simpleGit();

  // Check if repo already exists
  try {
    await fs.access(repoPath);
    // Repo exists, pull latest
    const repoGit = simpleGit(repoPath);
    await repoGit.fetch("origin");
    await repoGit.checkout(branch);
    await repoGit.pull("origin", branch);
  } catch {
    // Repo doesn't exist, clone it
    await git.clone(effectiveCloneUrl, repoPath, ["--branch", branch]);
  }

  return repoPath;
}

async function processExecution(
  job: Job<ExecutionJobData, ExecutionJobResult>
): Promise<ExecutionJobResult> {
  const { executionId, taskId, userId, apiKey, aiProvider, preferredModel, planContent, branch, cloneUrl } = job.data;

  // Create AI client with the specified provider
  const aiClient = await createAIClient(aiProvider, apiKey, preferredModel);

  // Update execution status to running
  await db
    .update(executions)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(executions.id, executionId));

  // Get task details
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  // Create worker job record for execution phase
  const [workerJob] = await db.insert(workerJobs).values({
    taskId,
    phase: "executing",
    status: "running",
    startedAt: new Date(),
    jobId: job.id,
  }).returning();

  // Emit initial thinking event
  await db.insert(workerEvents).values({
    workerJobId: workerJob.id,
    eventType: "thinking",
    content: "Preparing execution environment...",
    metadata: { model: preferredModel } as WorkerEventMetadata,
  });

  // Get user's GitHub token for authenticated git operations
  const githubToken = await getUserGithubToken(userId);

  // Clone or update the repository
  console.log(`Cloning/updating repository: ${task.repo.fullName}`);
  const repoPath = await cloneOrUpdateRepo(
    cloneUrl,
    task.repo.fullName.replace("/", "_"), // Sanitize path
    branch,
    githubToken
  );
  console.log(`Repository ready at: ${repoPath}`);

  // Create loop context with plan content for multi-agent mode
  const loopContext: LoopContext = {
    project: task.repo.name,
    changeId: task.id.slice(0, 8),
    workingDir: repoPath,
    tasksPath: path.join(repoPath, "tasks.md"),
    quickVerify: "echo 'Quick verify'",
    fullVerify: "echo 'Full verify'",
    doConstraints: [
      "Follow the plan steps exactly",
      "Make small, focused changes",
      "Write tests when appropriate",
    ],
    dontConstraints: [
      "Don't deviate from the plan",
      "Don't make unrelated changes",
      "Don't skip verification",
    ],
    // Include plan content for multi-agent mode
    planContent,
  };

  // Determine which execution mode to use
  const useMultiAgent = EXECUTION_MODE === "multi-agent" && planContent;

  console.log(`Execution mode: ${useMultiAgent ? "multi-agent" : "classic"}`);

  // Track stats for result summary
  let filesWritten = 0;
  let commandsRun = 0;

  try {
    const result = await runLoop(loopContext, {
      client: aiClient,
      maxIterations: 50,
      stuckThreshold: 3,
      mode: useMultiAgent ? "multi-agent" : "classic",
      parallelOptions: {
        maxConcurrency: 3,
        retryOnFailure: true,
        stopOnCriticalFailure: true,
        mandatoryReview: true,
        maxRetries: 1,
      },
      onEvent: async (event) => {
        // Store event in database (map event type to db-compatible type)
        await db.insert(executionEvents).values({
          id: crypto.randomUUID(),
          executionId,
          eventType: mapEventTypeToDb(event.type),
          content: event.content,
          metadata: {
            ...event.metadata,
            // Store the original event type in metadata for reference
            originalEventType: event.type,
          },
          createdAt: event.timestamp,
        });

        // Also insert to worker_events for unified history
        const workerEventType = mapEventTypeToWorkerEvent(event.type);
        await db.insert(workerEvents).values({
          workerJobId: workerJob.id,
          eventType: workerEventType,
          content: event.content,
          metadata: {
            ...event.metadata,
            iteration: event.metadata?.iteration,
          } as WorkerEventMetadata,
        });

        // Track stats
        if (event.type === "file_write") filesWritten++;
        if (event.type === "command_run") commandsRun++;

        // Update job progress
        const iteration = event.metadata?.iteration || 0;
        await job.updateProgress({
          iteration,
          lastEvent: event.type,
          progressPercent: event.metadata?.progressPercent || 0,
          agentId: event.metadata?.agentId,
          taskId: event.metadata?.taskId,
        });

        // Publish to Redis for SSE streaming to Workers page
        const progress = calculateExecutionProgress(iteration, 50, event.type);
        const currentStep = event.metadata?.taskId
          ? `Step ${event.metadata.taskId}`
          : `Iteration ${iteration}`;

        const workerEvent = createWorkerUpdateEvent(
          taskId,
          task.title,
          task.repo.name,
          "executing",
          {
            currentStep,
            currentAction: formatEventAction(event.type, event.content),
          }
        );
        // Override the calculated progress with our execution-specific calculation
        workerEvent.data.progress = progress;

        await publishWorkerEvent(userId, workerEvent);
      },
      onProgress: async (progress) => {
        // Store progress updates
        await job.updateProgress({
          ...progress,
        });
      },
    });

    // Update execution status
    const finalStatus = result.status === "complete" ? "completed" : "failed";
    await db
      .update(executions)
      .set({
        status: finalStatus,
        iteration: result.iterations,
        completedAt: new Date(),
        commits: result.commits, // JSONB handles native arrays
        errorMessage: result.error || null,
      })
      .where(eq(executions.id, executionId));

    // Update task status
    const taskStatus = result.status === "complete" ? "done" : "stuck";
    await db
      .update(tasks)
      .set({ status: taskStatus, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Emit completion event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "complete",
      content: taskStatus === "done" ? "Execution complete" : "Execution stuck",
      metadata: {
        commits: result.commits?.length || 0,
        filesWritten,
        commandsRun,
      } as WorkerEventMetadata,
    });

    // Update worker job as completed/failed
    const commitsCount = result.commits?.length || 0;
    await db.update(workerJobs)
      .set({
        status: result.status === "complete" ? "completed" : "failed",
        completedAt: new Date(),
        resultSummary: result.status === "complete"
          ? `${commitsCount} commit${commitsCount !== 1 ? "s" : ""}, ${filesWritten} file${filesWritten !== 1 ? "s" : ""} changed`
          : `Failed after ${result.iterations} iteration${result.iterations !== 1 ? "s" : ""}`,
        errorMessage: result.error || null,
      })
      .where(eq(workerJobs.id, workerJob.id));

    // Publish completion/stuck event to Redis for SSE
    const completionEvent = createWorkerUpdateEvent(
      taskId,
      task.title,
      task.repo.name,
      taskStatus,
      {
        currentAction: taskStatus === "done" ? "Execution complete" : "Execution stuck",
        error: result.error,
        completedAt: new Date(),
      }
    );
    await publishWorkerEvent(userId, completionEvent);

    return {
      success: result.status === "complete",
      commits: result.commits,
      error: result.error,
      completedAt: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update execution status
    await db
      .update(executions)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(executions.id, executionId));

    // Update task status
    await db
      .update(tasks)
      .set({ status: "stuck", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Update worker job as failed
    await db.update(workerJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(workerJobs.id, workerJob.id));

    // Emit error event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "error",
      content: errorMessage,
    });

    // Publish error event to Redis for SSE
    const errorEvent = createWorkerUpdateEvent(
      taskId,
      task.title,
      task.repo.name,
      "stuck",
      {
        currentAction: "Execution failed",
        error: errorMessage,
        completedAt: new Date(),
      }
    );
    await publishWorkerEvent(userId, errorEvent);

    return {
      success: false,
      error: errorMessage,
      completedAt: new Date(),
    };
  }
}

// Process brainstorm job
async function processBrainstorm(
  job: Job<BrainstormJobData, BrainstormJobResult>
): Promise<BrainstormJobResult> {
  const { taskId, userId, repoId, apiKey, aiProvider, preferredModel, continueToPlanning } = job.data;

  console.log(`[brainstorm-worker] Starting brainstorm for task ${taskId}`);

  // Create worker job record
  const [workerJob] = await db.insert(workerJobs).values({
    taskId,
    phase: "brainstorming",
    status: "running",
    startedAt: new Date(),
    jobId: job.id,
  }).returning();

  try {
    // Get task details
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const startedAt = task.processingStartedAt || new Date();

    // Create AI client
    const client = await createAIClient(aiProvider, apiKey, preferredModel);

    // Emit thinking event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "thinking",
      content: "Analyzing task requirements and context...",
      metadata: { model: preferredModel } as WorkerEventMetadata,
    });

    // Update status: Analyzing task...
    await db
      .update(tasks)
      .set({ processingStatusText: phaseStatusMessages.brainstorming[0] })
      .where(eq(tasks.id, taskId));

    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_update", taskId, task.title, task.repo.name, "brainstorming", job.id!, startedAt, {
        statusText: phaseStatusMessages.brainstorming[0],
        progress: 10,
      })
    );

    // Emit action event
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "action",
      content: "Generating ideas and requirements...",
      metadata: { model: preferredModel } as WorkerEventMetadata,
    });

    // Update status: Generating ideas...
    await db
      .update(tasks)
      .set({ processingStatusText: phaseStatusMessages.brainstorming[1] })
      .where(eq(tasks.id, taskId));

    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_update", taskId, task.title, task.repo.name, "brainstorming", job.id!, startedAt, {
        statusText: phaseStatusMessages.brainstorming[1],
        progress: 30,
      })
    );

    // Run brainstorm
    const result = await brainstormTask(client, task.title, task.description);

    // Update status: Finalizing brainstorm...
    await db
      .update(tasks)
      .set({ processingStatusText: phaseStatusMessages.brainstorming[3] })
      .where(eq(tasks.id, taskId));

    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_update", taskId, task.title, task.repo.name, "brainstorming", job.id!, startedAt, {
        statusText: phaseStatusMessages.brainstorming[3],
        progress: 80,
      })
    );

    const brainstormResultJson = JSON.stringify(result, null, 2);

    // Count requirements for result summary
    const requirementsCount = result.requirements?.length || 0;

    // Emit completion event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "complete",
      content: "Brainstorming complete",
      metadata: { requirementsCount } as WorkerEventMetadata,
    });

    // Update worker job as completed
    await db.update(workerJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultSummary: `Generated ${requirementsCount} requirement${requirementsCount !== 1 ? "s" : ""}`,
      })
      .where(eq(workerJobs.id, workerJob.id));

    // Update task with result and clear processing state
    await db
      .update(tasks)
      .set({
        brainstormResult: brainstormResultJson,
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish completion event
    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_complete", taskId, task.title, task.repo.name, "brainstorming", job.id!, startedAt, {
        statusText: "Brainstorm complete",
        progress: 100,
      })
    );

    // Also publish a worker update for the Workers page
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "brainstorming", {
        currentAction: "Brainstorm complete",
      })
    );

    console.log(`[brainstorm-worker] Brainstorm complete for task ${taskId}`);

    // If autonomous mode, queue planning job
    if (continueToPlanning) {
      console.log(`[brainstorm-worker] Autonomous mode: queueing plan for task ${taskId}`);

      const planJob = await queuePlan({
        taskId,
        userId,
        repoId,
        apiKey,
        aiProvider,
        preferredModel,
        brainstormResult: brainstormResultJson,
        continueToExecution: true,
        repoName: task.repo.name,
        repoFullName: task.repo.fullName,
        repoDefaultBranch: task.repo.defaultBranch || "main",
      });

      // Update task to planning phase
      await db
        .update(tasks)
        .set({
          status: "planning",
          processingPhase: "planning",
          processingJobId: planJob.id,
          processingStartedAt: new Date(),
          processingStatusText: phaseStatusMessages.planning[0],
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      // Publish processing_start for planning
      await publishProcessingEvent(
        userId,
        createProcessingEvent("processing_start", taskId, task.title, task.repo.name, "planning", planJob.id!, new Date(), {
          statusText: phaseStatusMessages.planning[0],
          progress: 0,
        })
      );
    }

    return {
      success: true,
      brainstormResult: brainstormResultJson,
      completedAt: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[brainstorm-worker] Error for task ${taskId}:`, errorMessage);

    // Update worker job as failed
    await db.update(workerJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(workerJobs.id, workerJob.id));

    // Emit error event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "error",
      content: errorMessage,
    });

    // Get task for event publishing
    const failedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    const startedAt = failedTask?.processingStartedAt || new Date();

    // Clear processing state and revert status
    await db
      .update(tasks)
      .set({
        status: "todo",
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish error event
    if (failedTask) {
      await publishProcessingEvent(
        userId,
        createProcessingEvent("processing_error", taskId, failedTask.title, failedTask.repo.name, "brainstorming", job.id!, startedAt, {
          error: errorMessage,
        })
      );
    }

    return {
      success: false,
      error: errorMessage,
      completedAt: new Date(),
    };
  }
}

// Process plan job
async function processPlan(
  job: Job<PlanJobData, PlanJobResult>
): Promise<PlanJobResult> {
  const { taskId, userId, repoId, apiKey, aiProvider, preferredModel, brainstormResult, continueToExecution, repoName, repoFullName, repoDefaultBranch, techStack } = job.data;

  console.log(`[plan-worker] Starting plan for task ${taskId}`);

  // Create worker job record
  const [workerJob] = await db.insert(workerJobs).values({
    taskId,
    phase: "planning",
    status: "running",
    startedAt: new Date(),
    jobId: job.id,
  }).returning();

  try {
    // Get task details
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const startedAt = task.processingStartedAt || new Date();

    // Create AI client
    const client = await createAIClient(aiProvider, apiKey, preferredModel);

    // Emit thinking event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "thinking",
      content: "Reviewing brainstorm results...",
      metadata: { model: preferredModel } as WorkerEventMetadata,
    });

    // Update status: Reviewing brainstorm...
    await db
      .update(tasks)
      .set({ processingStatusText: phaseStatusMessages.planning[0] })
      .where(eq(tasks.id, taskId));

    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_update", taskId, task.title, task.repo.name, "planning", job.id!, startedAt, {
        statusText: phaseStatusMessages.planning[0],
        progress: 10,
      })
    );

    // Emit action event
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "action",
      content: "Designing implementation plan...",
      metadata: { model: preferredModel } as WorkerEventMetadata,
    });

    // Update status: Designing plan...
    await db
      .update(tasks)
      .set({ processingStatusText: phaseStatusMessages.planning[1] })
      .where(eq(tasks.id, taskId));

    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_update", taskId, task.title, task.repo.name, "planning", job.id!, startedAt, {
        statusText: phaseStatusMessages.planning[1],
        progress: 30,
      })
    );

    // Generate plan with repo context
    const result = await generatePlan(
      client,
      task.title,
      task.description,
      brainstormResult,
      {
        name: repoName || task.repo.name,
        fullName: repoFullName || task.repo.fullName,
        defaultBranch: repoDefaultBranch || task.repo.defaultBranch || "main",
        techStack,
      }
    );

    // Update status: Finalizing plan...
    await db
      .update(tasks)
      .set({ processingStatusText: phaseStatusMessages.planning[3] })
      .where(eq(tasks.id, taskId));

    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_update", taskId, task.title, task.repo.name, "planning", job.id!, startedAt, {
        statusText: phaseStatusMessages.planning[3],
        progress: 80,
      })
    );

    const planContentJson = JSON.stringify(result, null, 2);
    const branchName = `loopforge/${taskId.slice(0, 8)}`;

    // Count steps for result summary
    const stepsCount = result.steps?.length || 0;

    // Emit completion event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "complete",
      content: "Planning complete",
      metadata: { stepsCount } as WorkerEventMetadata,
    });

    // Update worker job as completed
    await db.update(workerJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultSummary: `Created ${stepsCount}-step plan`,
      })
      .where(eq(workerJobs.id, workerJob.id));

    // Update task with result and clear processing state
    await db
      .update(tasks)
      .set({
        planContent: planContentJson,
        branch: branchName,
        status: continueToExecution ? "ready" : "planning",
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish completion event
    await publishProcessingEvent(
      userId,
      createProcessingEvent("processing_complete", taskId, task.title, task.repo.name, "planning", job.id!, startedAt, {
        statusText: "Plan complete",
        progress: 100,
      })
    );

    // Also publish a worker update for the Workers page
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, continueToExecution ? "ready" : "planning", {
        currentAction: "Plan complete",
      })
    );

    console.log(`[plan-worker] Plan complete for task ${taskId}`);

    // If autonomous mode, queue execution job
    if (continueToExecution) {
      console.log(`[plan-worker] Autonomous mode: queueing execution for task ${taskId}`);

      // Get repo details
      const repo = await db.query.repos.findFirst({
        where: eq(repos.id, repoId),
      });

      if (!repo) {
        throw new Error("Repository not found");
      }

      // Create execution record
      const [execution] = await db
        .insert(executions)
        .values({
          taskId,
          status: "queued",
          iteration: 0,
        })
        .returning();

      // Update task to executing
      await db
        .update(tasks)
        .set({
          status: "executing",
          processingPhase: "executing",
          processingJobId: execution.id,
          processingStartedAt: new Date(),
          processingStatusText: phaseStatusMessages.executing[0],
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      // Queue execution
      await queueExecution({
        executionId: execution.id,
        taskId,
        repoId,
        userId,
        apiKey,
        aiProvider,
        preferredModel,
        planContent: planContentJson,
        branch: branchName,
        cloneUrl: repo.cloneUrl,
      });

      // Publish executing event
      await publishWorkerEvent(
        userId,
        createWorkerUpdateEvent(taskId, task.title, task.repo.name, "executing", {
          currentAction: "Starting execution...",
          currentStep: "Step 1",
        })
      );
    }

    return {
      success: true,
      planContent: planContentJson,
      branch: branchName,
      completedAt: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[plan-worker] Error for task ${taskId}:`, errorMessage);

    // Update worker job as failed
    await db.update(workerJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(workerJobs.id, workerJob.id));

    // Emit error event to worker_events
    await db.insert(workerEvents).values({
      workerJobId: workerJob.id,
      eventType: "error",
      content: errorMessage,
    });

    // Get task for event publishing
    const failedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    const startedAt = failedTask?.processingStartedAt || new Date();

    // Clear processing state and revert status
    await db
      .update(tasks)
      .set({
        status: "brainstorming",
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish error event
    if (failedTask) {
      await publishProcessingEvent(
        userId,
        createProcessingEvent("processing_error", taskId, failedTask.title, failedTask.repo.name, "planning", job.id!, startedAt, {
          error: errorMessage,
        })
      );
    }

    return {
      success: false,
      error: errorMessage,
      completedAt: new Date(),
    };
  }
}

// Create and start the execution worker
const worker = createExecutionWorker(processExecution);

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result.success ? "success" : "failed");
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

console.log("Execution worker started");

// Create and start the autonomous flow worker
const autonomousWorker = createAutonomousFlowWorker();

autonomousWorker.on("completed", (job, result) => {
  console.log(
    `Autonomous flow ${job.id} completed:`,
    result.success ? "success" : "failed",
    `(task status: ${result.finalStatus})`
  );
});

autonomousWorker.on("failed", (job, err) => {
  console.error(`Autonomous flow ${job?.id} failed:`, err.message);
});

autonomousWorker.on("error", (err) => {
  console.error("Autonomous flow worker error:", err);
});

console.log("Autonomous flow worker started");

// Create and start the brainstorm worker
const brainstormWorker = createBrainstormWorker(processBrainstorm);

brainstormWorker.on("completed", (job, result) => {
  console.log(`Brainstorm job ${job.id} completed:`, result.success ? "success" : "failed");
});

brainstormWorker.on("failed", (job, err) => {
  console.error(`Brainstorm job ${job?.id} failed:`, err.message);
});

brainstormWorker.on("error", (err) => {
  console.error("Brainstorm worker error:", err);
});

console.log("Brainstorm worker started");

// Create and start the plan worker
const planWorker = createPlanWorker(processPlan);

planWorker.on("completed", (job, result) => {
  console.log(`Plan job ${job.id} completed:`, result.success ? "success" : "failed");
});

planWorker.on("failed", (job, err) => {
  console.error(`Plan job ${job?.id} failed:`, err.message);
});

planWorker.on("error", (err) => {
  console.error("Plan worker error:", err);
});

console.log("Plan worker started");

export { worker, autonomousWorker, brainstormWorker, planWorker };
export default worker;
