import { Job } from "bullmq";
import { db, users, tasks, executions, executionEvents } from "../lib/db";
import { eq } from "drizzle-orm";
import { runLoop, type LoopContext } from "../lib/ralph";
import {
  createExecutionWorker,
  type ExecutionJobData,
  type ExecutionJobResult,
} from "../lib/queue";
import { decryptGithubToken } from "../lib/crypto";
import { createAIClient } from "../lib/ai/client";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";

const REPOS_DIR = process.env.REPOS_DIR || "/app/repos";

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

  // Parse plan
  let plan: { steps: Array<{ id: string; title: string; description: string }> };
  try {
    plan = JSON.parse(planContent);
  } catch {
    plan = { steps: [{ id: "1", title: "Execute task", description: planContent }] };
  }

  // Create loop context
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
  };

  const commits: string[] = [];

  try {
    const result = await runLoop(loopContext, {
      client: aiClient,
      maxIterations: 50,
      stuckThreshold: 3,
      onEvent: async (event) => {
        // Store event in database
        await db.insert(executionEvents).values({
          id: crypto.randomUUID(),
          executionId,
          eventType: event.type,
          content: event.content,
          metadata: event.metadata || null, // JSONB handles native objects
          createdAt: event.timestamp,
        });

        // Update job progress
        await job.updateProgress({
          iteration: event.metadata?.iteration || 0,
          lastEvent: event.type,
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

    return {
      success: false,
      error: errorMessage,
      completedAt: new Date(),
    };
  }
}

// Create and start the worker
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

export default worker;
