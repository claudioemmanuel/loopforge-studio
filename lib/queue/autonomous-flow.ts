import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";
import { queueExecution, type ExecutionJobData } from "./execution-queue";
import { db, tasks, users, repos, executions } from "@/lib/db";
import { eq, and, or } from "drizzle-orm";
import {
  createAIClient,
  generateInitialBrainstorm,
  generatePlan,
  type RepoContext,
} from "@/lib/ai";
import { decryptApiKey, decryptGithubToken } from "@/lib/crypto";
import { scanRepoViaGitHub } from "@/lib/github/repo-scanner";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import {
  publishWorkerEvent,
  createWorkerUpdateEvent,
} from "@/lib/workers/events";
import { queueLogger } from "@/lib/logger";

export interface AutonomousFlowJobData {
  taskId: string;
  userId: string;
  repoId: string;
}

export interface AutonomousFlowJobResult {
  success: boolean;
  finalStatus: "executing" | "stuck";
  error?: string;
}

// Queue for autonomous flow jobs
export const autonomousFlowQueue = new Queue<
  AutonomousFlowJobData,
  AutonomousFlowJobResult
>("autonomous-flow", { connection: connectionOptions });

// Add a job to the queue
export async function queueAutonomousFlow(
  data: AutonomousFlowJobData,
): Promise<Job<AutonomousFlowJobData, AutonomousFlowJobResult>> {
  return autonomousFlowQueue.add("autonomous", data, {
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 50,
    },
  });
}

// Process autonomous flow
async function processAutonomousFlow(
  job: Job<AutonomousFlowJobData, AutonomousFlowJobResult>,
): Promise<AutonomousFlowJobResult> {
  const { taskId, userId, repoId } = job.data;

  queueLogger.info({ taskId }, "Starting autonomous flow");

  try {
    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Find configured AI provider
    const aiProvider = findConfiguredProvider(user);

    if (!aiProvider) {
      throw new Error("No AI provider configured");
    }

    const encryptedKey = getProviderApiKey(user, aiProvider);
    if (!encryptedKey) {
      throw new Error(`No API key configured for ${aiProvider}`);
    }

    const apiKey = decryptApiKey(encryptedKey);
    const model = getPreferredModel(user, aiProvider);
    const client = await createAIClient(aiProvider, apiKey, model);

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // Step 1: Generate brainstorm if not already done
    queueLogger.info({ taskId, step: 1 }, "Generating brainstorm");
    await job.updateProgress({ step: "brainstorming", progress: 10 });

    // Publish brainstorming started event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(
        taskId,
        task.title,
        task.repo.name,
        "brainstorming",
        {
          currentAction: "Generating ideas...",
        },
      ),
    );

    // Scan repository via GitHub API for actual context
    let repoContext: RepoContext;
    if (user.encryptedGithubToken && user.githubTokenIv) {
      try {
        const githubToken = decryptGithubToken({
          encrypted: user.encryptedGithubToken,
          iv: user.githubTokenIv,
        });
        const [owner, repoName] = task.repo.fullName.split("/");
        queueLogger.info({ repo: task.repo.fullName }, "Scanning repo");
        const githubContext = await scanRepoViaGitHub(
          githubToken,
          owner,
          repoName,
          task.repo.defaultBranch || "main",
        );
        queueLogger.info(
          { techStack: githubContext.techStack },
          "Tech stack detected",
        );
        repoContext = {
          techStack: githubContext.techStack,
          fileStructure: githubContext.fileStructure,
          configFiles: githubContext.configFiles,
        };
      } catch (error) {
        queueLogger.error({ error }, "GitHub scan failed");
        repoContext = { techStack: [], fileStructure: [], configFiles: [] };
      }
    } else {
      queueLogger.info("No GitHub token, using empty context");
      repoContext = { techStack: [], fileStructure: [], configFiles: [] };
    }

    const brainstormResult = await generateInitialBrainstorm(
      client,
      task.title,
      task.description,
      repoContext,
    );

    // Update task with brainstorm result - atomic claim to prevent race with user actions
    // Only update if task is still in todo or brainstorming state (user hasn't moved it)
    const brainstormUpdate = await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(brainstormResult),
        status: "brainstorming",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          or(eq(tasks.status, "todo"), eq(tasks.status, "brainstorming")),
        ),
      )
      .returning({ id: tasks.id });

    if (brainstormUpdate.length === 0) {
      throw new Error(
        "Task state changed during autonomous flow - brainstorm update aborted",
      );
    }

    await job.updateProgress({ step: "brainstorming", progress: 33 });
    queueLogger.info({ taskId }, "Brainstorm complete");

    // Step 2: Generate plan
    queueLogger.info({ taskId, step: 2 }, "Generating plan");
    await job.updateProgress({ step: "planning", progress: 40 });

    // Publish planning started event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "planning", {
        currentAction: "Creating execution plan...",
      }),
    );

    const planResult = await generatePlan(
      client,
      task.title,
      task.description,
      JSON.stringify(brainstormResult),
      {
        name: task.repo.name,
        fullName: task.repo.fullName,
        defaultBranch: task.repo.defaultBranch || "main",
        techStack: repoContext.techStack,
      },
    );

    // Generate branch name
    const branchName = `loopforge/${taskId.slice(0, 8)}`;

    // Update task with plan result - atomic claim to prevent race with user actions
    // Only update if task is still in brainstorming state
    const planUpdate = await db
      .update(tasks)
      .set({
        planContent: JSON.stringify(planResult),
        status: "planning",
        branch: branchName,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "brainstorming")))
      .returning({ id: tasks.id });

    if (planUpdate.length === 0) {
      throw new Error(
        "Task state changed during autonomous flow - plan update aborted",
      );
    }

    await job.updateProgress({ step: "planning", progress: 66 });
    queueLogger.info({ taskId }, "Plan complete");

    // Step 3: Mark ready and queue execution
    queueLogger.info(
      { taskId, step: 3 },
      "Marking ready and queueing execution",
    );
    await job.updateProgress({ step: "ready", progress: 70 });

    // Publish ready event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "ready", {
        currentAction: "Ready for execution",
      }),
    );

    // Update to ready status - atomic claim to prevent race with user actions
    // Only update if task is still in planning state
    const readyUpdate = await db
      .update(tasks)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "planning")))
      .returning({ id: tasks.id });

    if (readyUpdate.length === 0) {
      throw new Error(
        "Task state changed during autonomous flow - ready update aborted",
      );
    }

    // Get repo details for execution
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

    // Update task to executing - atomic claim to prevent race with user actions
    // Only update if task is still in ready state
    const executingUpdate = await db
      .update(tasks)
      .set({
        status: "executing",
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "ready")))
      .returning({ id: tasks.id });

    if (executingUpdate.length === 0) {
      // Clean up the execution record we just created since we can't proceed
      await db.delete(executions).where(eq(executions.id, execution.id));
      throw new Error(
        "Task state changed during autonomous flow - executing update aborted",
      );
    }

    // Publish executing event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "executing", {
        currentAction: "Executing plan...",
        currentStep: "Step 1/" + (planResult.steps?.length || 1),
      }),
    );

    await job.updateProgress({ step: "executing", progress: 80 });

    // Queue the execution job
    // Worker will decrypt API key on demand using userId
    const executionData: ExecutionJobData = {
      executionId: execution.id,
      taskId,
      repoId,
      userId,
      aiProvider,
      preferredModel: model,
      planContent: JSON.stringify(planResult),
      branch: branchName,
      defaultBranch: task.repo.defaultBranch || "main",
      cloneUrl: repo.cloneUrl,
    };

    await queueExecution(executionData);

    await job.updateProgress({ step: "executing", progress: 100 });
    queueLogger.info({ taskId }, "Execution queued");

    return {
      success: true,
      finalStatus: "executing",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    queueLogger.error({ taskId, error: errorMessage }, "Autonomous flow error");

    // Get task for event publishing
    const failedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    // Update task to stuck status
    await db
      .update(tasks)
      .set({
        status: "stuck",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish stuck event
    if (failedTask) {
      await publishWorkerEvent(
        userId,
        createWorkerUpdateEvent(
          taskId,
          failedTask.title,
          failedTask.repo.name,
          "stuck",
          {
            error: errorMessage,
          },
        ),
      );
    }

    return {
      success: false,
      finalStatus: "stuck",
      error: errorMessage,
    };
  }
}

// Create worker
export function createAutonomousFlowWorker() {
  return new Worker<AutonomousFlowJobData, AutonomousFlowJobResult>(
    "autonomous-flow",
    processAutonomousFlow,
    {
      connection: createConnectionOptions(),
      concurrency: 2, // Allow 2 autonomous flows at a time
    },
  );
}

// Export for use in worker process
export { processAutonomousFlow };
