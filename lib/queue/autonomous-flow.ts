import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";
import {
  createAIClient,
  generateInitialBrainstorm,
  generatePlan,
  type RepoContext,
} from "@/lib/ai";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { decryptApiKey, decryptGithubToken } from "@/lib/crypto";
import { scanRepoViaGitHub } from "@/lib/github/repo-scanner";
import {
  queueExecution,
  type ExecutionJobData,
} from "@/lib/queue/execution-queue";
import { queueLogger } from "@/lib/logger";
import {
  createWorkerUpdateEvent,
  publishWorkerEvent,
} from "@/lib/workers/events";
import { getUserService } from "@/lib/contexts/iam/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

// =========================================================================
// Types
// =========================================================================

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

// =========================================================================
// Processor
// =========================================================================

export async function processAutonomousFlow(
  job: Job<AutonomousFlowJobData, AutonomousFlowJobResult>,
): Promise<AutonomousFlowJobResult> {
  const { taskId, userId, repoId } = job.data;
  const userService = getUserService();
  const taskService = getTaskService();
  const repositoryService = getRepositoryService();
  const executionService = getExecutionService();

  queueLogger.info({ taskId }, "Starting autonomous flow");

  try {
    // Get user
    const user = await userService.getUserFull(userId);

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
    const task = await taskService.getTaskFull(taskId);

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

    // Update task with brainstorm result – only if task is still in todo/brainstorming
    const brainstormUpdate = await taskService.updateIfStatus(
      taskId,
      ["todo", "brainstorming"],
      {
        brainstormResult: JSON.stringify(brainstormResult),
        status: "brainstorming",
      },
    );

    if (!brainstormUpdate) {
      throw new Error(
        "Task state changed during autonomous flow - brainstorm update aborted",
      );
    }

    await job.updateProgress({ step: "brainstorming", progress: 33 });
    queueLogger.info({ taskId }, "Brainstorm complete");

    // Step 2: Generate plan
    queueLogger.info({ taskId, step: 2 }, "Generating plan");
    await job.updateProgress({ step: "planning", progress: 40 });

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

    const branchName = `loopforge/${taskId.slice(0, 8)}`;

    // Update task with plan – only if task is still brainstorming
    const planUpdate = await taskService.updateIfStatus(
      taskId,
      ["brainstorming"],
      {
        planContent: JSON.stringify(planResult),
        status: "planning",
        branch: branchName,
      },
    );

    if (!planUpdate) {
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

    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "ready", {
        currentAction: "Ready for execution",
      }),
    );

    // Update to ready – only if task is still planning
    const readyUpdate = await taskService.updateIfStatus(taskId, ["planning"], {
      status: "ready",
    });

    if (!readyUpdate) {
      throw new Error(
        "Task state changed during autonomous flow - ready update aborted",
      );
    }

    const repo = await repositoryService.findByOwner(repoId, userId);

    if (!repo) {
      throw new Error("Repository not found");
    }

    // Create execution record
    const executionId = crypto.randomUUID();
    await executionService.createQueued({
      id: executionId,
      taskId,
    });

    // Update task to executing – only if task is still ready
    const executingUpdate = await taskService.updateIfStatus(
      taskId,
      ["ready"],
      {
        status: "executing",
      },
    );

    if (!executingUpdate) {
      await executionService.deleteById(executionId);
      throw new Error(
        "Task state changed during autonomous flow - executing update aborted",
      );
    }

    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "executing", {
        currentAction: "Executing plan...",
        currentStep: "Step 1/" + (planResult.steps?.length || 1),
      }),
    );

    await job.updateProgress({ step: "executing", progress: 80 });

    // Queue the execution job – worker decrypts API key on demand via userId
    const executionData: ExecutionJobData = {
      executionId,
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

    const failedTask = await taskService.getTaskFull(taskId);

    await taskService.updateFields(taskId, { status: "stuck" });

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

// =========================================================================
// Queue & Worker
// =========================================================================

export const autonomousFlowQueue = new Queue<
  AutonomousFlowJobData,
  AutonomousFlowJobResult
>("autonomous-flow", { connection: connectionOptions });

export async function queueAutonomousFlow(
  data: AutonomousFlowJobData,
): Promise<Job<AutonomousFlowJobData, AutonomousFlowJobResult>> {
  return autonomousFlowQueue.add("autonomous-flow", data, {
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 50,
    },
  });
}

export function createAutonomousFlowWorker() {
  return new Worker<AutonomousFlowJobData, AutonomousFlowJobResult>(
    "autonomous-flow",
    processAutonomousFlow,
    {
      connection: createConnectionOptions(),
      concurrency: 2,
    },
  );
}
