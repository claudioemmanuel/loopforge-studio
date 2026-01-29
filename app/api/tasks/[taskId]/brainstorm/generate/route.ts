import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import {
  createAIClient,
  generateInitialBrainstorm,
  type RepoContext,
} from "@/lib/ai";
import { decryptApiKey, decryptGithubToken } from "@/lib/crypto";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { queueAutonomousFlow } from "@/lib/queue";
import { scanRepoViaGitHub, getTestCoverageContext } from "@/lib/github";
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/tasks/[taskId]/brainstorm/generate
 *
 * Generates initial brainstorm result without chat interaction.
 * Called when clicking "Start Brainstorming" button.
 * On success: updates task with result, changes status to "brainstorming", returns updated task.
 * On error: returns error, task status remains unchanged.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Get task with repo
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return handleError(Errors.notFound("Task"));
  }

  // Check if autonomous mode is enabled
  if (task.autonomousMode) {
    apiLogger.info(
      { taskId },
      "Autonomous mode enabled, queueing autonomous flow",
    );

    // ATOMIC: Claim the processing slot first to prevent race conditions
    // This UPDATE only succeeds if processingPhase is NULL (not already processing)
    const claimResult = await db
      .update(tasks)
      .set({
        status: "brainstorming",
        processingPhase: "brainstorming",
        processingStatusText: "Starting autonomous flow...",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          isNull(tasks.processingPhase), // Only claim if not already processing
        ),
      )
      .returning();

    // If no rows were updated, another request already claimed the slot
    if (claimResult.length === 0) {
      return handleError(Errors.conflict("Task is already processing"));
    }

    try {
      // Queue the autonomous flow job (we have exclusive processing rights)
      const job = await queueAutonomousFlow({
        taskId,
        userId: session.user.id,
        repoId: task.repo.id,
      });

      // Update with job ID
      await db
        .update(tasks)
        .set({ processingJobId: job.id })
        .where(eq(tasks.id, taskId));

      return NextResponse.json(claimResult[0]);
    } catch (error) {
      // If queuing failed after claiming, reset the processing state
      await db
        .update(tasks)
        .set({
          status: task.status, // Restore original status
          processingPhase: null,
          processingJobId: null,
          processingStatusText: null,
        })
        .where(eq(tasks.id, taskId));

      apiLogger.error({ taskId, error }, "Failed to queue autonomous flow");
      return handleError(error);
    }
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return handleError(Errors.notFound("User"));
  }

  // Find configured provider
  const aiProvider = findConfiguredProvider(user);

  if (!aiProvider) {
    return handleError(Errors.noProviderConfigured());
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return handleError(Errors.authError(aiProvider));
  }

  try {
    apiLogger.debug({ provider: aiProvider }, "Decrypting API key");
    const apiKey = decryptApiKey(encryptedKey);

    apiLogger.debug("Getting preferred model");
    const model = getPreferredModel(user, aiProvider);
    apiLogger.debug({ model }, "Using model");

    apiLogger.debug("Creating AI client");
    const client = await createAIClient(aiProvider, apiKey, model);
    apiLogger.debug("AI client created successfully");

    // Scan repository via GitHub API for real context
    let repoContext: RepoContext;
    let testCoverageContext = "";

    if (user.encryptedGithubToken && user.githubTokenIv) {
      try {
        apiLogger.debug("Scanning repository via GitHub API");
        const githubToken = decryptGithubToken({
          encrypted: user.encryptedGithubToken,
          iv: user.githubTokenIv,
        });

        const [owner, repoName] = task.repo.fullName.split("/");
        const githubContext = await scanRepoViaGitHub(
          githubToken,
          owner,
          repoName,
          task.repo.defaultBranch || "main",
        );

        repoContext = {
          techStack: githubContext.techStack,
          fileStructure: githubContext.fileStructure,
          configFiles: githubContext.configFiles,
        };

        // Add test coverage context for test-related tasks
        const lowerTitle = task.title.toLowerCase();
        if (lowerTitle.includes("test") || lowerTitle.includes("coverage")) {
          testCoverageContext = getTestCoverageContext(githubContext);
        }

        apiLogger.debug(
          {
            techStack: repoContext.techStack.length,
            files: repoContext.fileStructure.length,
            testFiles: githubContext.testFiles.length,
          },
          "Repository scanned",
        );
      } catch (error) {
        apiLogger.error({ error }, "GitHub scan failed, using defaults");
        repoContext = {
          techStack: [],
          fileStructure: [],
          configFiles: [],
        };
      }
    } else {
      apiLogger.debug("No GitHub token, using empty context");
      repoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
      };
    }

    // ATOMIC: Claim the processing slot first to prevent concurrent brainstorms
    // This UPDATE only succeeds if processingPhase is NULL (not already processing)
    const claimResult = await db
      .update(tasks)
      .set({
        status: "brainstorming",
        processingPhase: "brainstorming",
        processingStatusText: "Generating initial brainstorm...",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          isNull(tasks.processingPhase), // Only claim if not already processing
        ),
      )
      .returning();

    // If no rows were updated, another request already claimed the slot
    if (claimResult.length === 0) {
      return handleError(Errors.conflict("Task is already processing"));
    }

    // Generate the initial brainstorm
    // Append test coverage context to description for test-related tasks
    const enrichedDescription = testCoverageContext
      ? `${task.description || ""}${testCoverageContext}`
      : task.description;

    apiLogger.debug({ taskId }, "Generating initial brainstorm");
    const brainstormResult = await generateInitialBrainstorm(
      client,
      task.title,
      enrichedDescription,
      repoContext,
    );
    apiLogger.debug({ taskId }, "Brainstorm generated successfully");

    // Update task with result and clear processing state
    const [updatedTask] = await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(brainstormResult),
        status: "brainstorming",
        processingPhase: null, // Clear processing state
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    apiLogger.debug({ taskId }, "Task updated successfully");

    return NextResponse.json(updatedTask);
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm generate error");

    // Clear processing state on error to allow retry
    await db
      .update(tasks)
      .set({
        status: task.status, // Restore original status
        processingPhase: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return handleError(error);
  }
}
