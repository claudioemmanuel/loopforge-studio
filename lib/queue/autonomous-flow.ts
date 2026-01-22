import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";
import { queueExecution, type ExecutionJobData } from "./execution-queue";
import { db, tasks, users, repos, executions } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createAIClient,
  getDefaultModel,
  generateInitialBrainstorm,
  generatePlan,
  type RepoContext,
} from "@/lib/ai";
import { decryptApiKey, decryptGithubToken } from "@/lib/crypto";
import type { AiProvider, User, Task } from "@/lib/db/schema";
import { publishWorkerEvent, createWorkerUpdateEvent } from "@/lib/workers/events";

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
export const autonomousFlowQueue = new Queue<AutonomousFlowJobData, AutonomousFlowJobResult>(
  "autonomous-flow",
  { connection: connectionOptions }
);

// Add a job to the queue
export async function queueAutonomousFlow(
  data: AutonomousFlowJobData
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

// Helper functions for getting API keys and models
function getProviderApiKey(
  user: User,
  provider: AiProvider
): { encrypted: string; iv: string } | null {
  switch (provider) {
    case "anthropic":
      return user.encryptedApiKey && user.apiKeyIv
        ? { encrypted: user.encryptedApiKey, iv: user.apiKeyIv }
        : null;
    case "openai":
      return user.openaiEncryptedApiKey && user.openaiApiKeyIv
        ? { encrypted: user.openaiEncryptedApiKey, iv: user.openaiApiKeyIv }
        : null;
    case "gemini":
      return user.geminiEncryptedApiKey && user.geminiApiKeyIv
        ? { encrypted: user.geminiEncryptedApiKey, iv: user.geminiApiKeyIv }
        : null;
    default:
      return null;
  }
}

function getPreferredModel(user: User, provider: AiProvider): string {
  switch (provider) {
    case "anthropic":
      return user.preferredAnthropicModel || getDefaultModel("anthropic");
    case "openai":
      return user.preferredOpenaiModel || getDefaultModel("openai");
    case "gemini":
      return user.preferredGeminiModel || getDefaultModel("gemini");
    default:
      return getDefaultModel("anthropic");
  }
}

// Process autonomous flow
async function processAutonomousFlow(
  job: Job<AutonomousFlowJobData, AutonomousFlowJobResult>
): Promise<AutonomousFlowJobResult> {
  const { taskId, userId, repoId } = job.data;

  console.log(`[autonomous-flow] Starting autonomous flow for task ${taskId}`);

  try {
    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Find configured AI provider
    const providers: AiProvider[] = ["anthropic", "openai", "gemini"];
    let aiProvider: AiProvider | null = null;

    if (user.preferredProvider && getProviderApiKey(user, user.preferredProvider)) {
      aiProvider = user.preferredProvider;
    } else {
      for (const provider of providers) {
        if (getProviderApiKey(user, provider)) {
          aiProvider = provider;
          break;
        }
      }
    }

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
    let task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // Step 1: Generate brainstorm if not already done
    console.log(`[autonomous-flow] Step 1: Generating brainstorm for task ${taskId}`);
    await job.updateProgress({ step: "brainstorming", progress: 10 });

    // Publish brainstorming started event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "brainstorming", {
        currentAction: "Generating ideas...",
      })
    );

    const repoContext: RepoContext = {
      techStack: ["Next.js", "React", "TypeScript", "Drizzle ORM"],
      fileStructure: ["app/", "components/", "lib/", "public/"],
      configFiles: ["package.json", "tsconfig.json", "next.config.ts"],
    };

    const brainstormResult = await generateInitialBrainstorm(
      client,
      task.title,
      task.description,
      repoContext
    );

    // Update task with brainstorm result
    await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(brainstormResult),
        status: "brainstorming",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await job.updateProgress({ step: "brainstorming", progress: 33 });
    console.log(`[autonomous-flow] Brainstorm complete for task ${taskId}`);

    // Step 2: Generate plan
    console.log(`[autonomous-flow] Step 2: Generating plan for task ${taskId}`);
    await job.updateProgress({ step: "planning", progress: 40 });

    // Publish planning started event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "planning", {
        currentAction: "Creating execution plan...",
      })
    );

    const planResult = await generatePlan(
      client,
      task.title,
      task.description,
      JSON.stringify(brainstormResult)
    );

    // Generate branch name
    const branchName = `loopforge/${taskId.slice(0, 8)}`;

    // Update task with plan result
    await db
      .update(tasks)
      .set({
        planContent: JSON.stringify(planResult),
        status: "planning",
        branch: branchName,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await job.updateProgress({ step: "planning", progress: 66 });
    console.log(`[autonomous-flow] Plan complete for task ${taskId}`);

    // Step 3: Mark ready and queue execution
    console.log(`[autonomous-flow] Step 3: Marking ready and queueing execution for task ${taskId}`);
    await job.updateProgress({ step: "ready", progress: 70 });

    // Publish ready event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "ready", {
        currentAction: "Ready for execution",
      })
    );

    // Update to ready status
    await db
      .update(tasks)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

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

    // Update task to executing
    await db
      .update(tasks)
      .set({
        status: "executing",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Publish executing event
    await publishWorkerEvent(
      userId,
      createWorkerUpdateEvent(taskId, task.title, task.repo.name, "executing", {
        currentAction: "Executing plan...",
        currentStep: "Step 1/" + (planResult.steps?.length || 1),
      })
    );

    await job.updateProgress({ step: "executing", progress: 80 });

    // Queue the execution job
    const executionData: ExecutionJobData = {
      executionId: execution.id,
      taskId,
      repoId,
      userId,
      apiKey,
      aiProvider,
      preferredModel: model,
      planContent: JSON.stringify(planResult),
      branch: branchName,
      cloneUrl: repo.cloneUrl,
    };

    await queueExecution(executionData);

    await job.updateProgress({ step: "executing", progress: 100 });
    console.log(`[autonomous-flow] Execution queued for task ${taskId}`);

    return {
      success: true,
      finalStatus: "executing",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[autonomous-flow] Error for task ${taskId}:`, errorMessage);

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
        createWorkerUpdateEvent(taskId, failedTask.title, failedTask.repo.name, "stuck", {
          error: errorMessage,
        })
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
    }
  );
}

// Export for use in worker process
export { processAutonomousFlow };
