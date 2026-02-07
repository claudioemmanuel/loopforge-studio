import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { getTaskService } from "@/lib/contexts/task/api";
import { getUserService } from "@/lib/contexts/iam/api";

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

  const taskService = getTaskService();
  const task = await taskService.getTaskFull(taskId);

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
    const claimUseCase = UseCaseFactory.claimBrainstormingSlot();
    const claimResult = await claimUseCase.execute({
      taskId,
      workerId: "Starting autonomous flow...",
    });

    if (claimResult.isFailure) {
      return handleError(Errors.conflict("Task is already processing"));
    }

    try {
      // Queue the autonomous flow job (we have exclusive processing rights)
      const job = await queueAutonomousFlow({
        taskId,
        userId: session.user.id,
        repoId: task.repo.id,
      });

      // Record the job ID via use-case
      const updateConversationUseCase =
        UseCaseFactory.updateBrainstormConversation();
      await updateConversationUseCase.execute({
        taskId,
        conversation: "[]", // Empty conversation for autonomous mode
      });

      // Store job ID via raw persistence (not part of brainstorm conversation)
      await taskService.updateFields(taskId, { processingJobId: job.id });

      return NextResponse.json(claimResult.value);
    } catch (error) {
      // If queuing failed after claiming, reset the processing state
      const clearUseCase = UseCaseFactory.clearProcessingSlot();
      await clearUseCase.execute({
        taskId,
        revertToStatus: task.status,
      });

      apiLogger.error({ taskId, error }, "Failed to queue autonomous flow");
      return handleError(error);
    }
  }

  // Manual brainstorm path – need full user row for AI key
  const userService = getUserService();
  const user = await userService.getUserFull(session.user.id);

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
    const claimUseCase = UseCaseFactory.claimBrainstormingSlot();
    const claimResult = await claimUseCase.execute({
      taskId,
      workerId: "Generating initial brainstorm...",
    });

    if (claimResult.isFailure) {
      return handleError(Errors.conflict("Task is already processing"));
    }

    // Generate the initial brainstorm
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

    // Save result and clear processing state via use-case
    const updateConversationUseCase =
      UseCaseFactory.updateBrainstormConversation();
    const updateResult = await updateConversationUseCase.execute({
      taskId,
      conversation: "[]", // Empty conversation for initial generate
      result: JSON.stringify(brainstormResult),
    });

    if (updateResult.isFailure) {
      return handleError(updateResult.error);
    }

    // Clear processing slot and transition to brainstorming status
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({
      taskId,
      revertToStatus: "brainstorming",
    });

    // Get updated task
    const getTaskUseCase = UseCaseFactory.getTaskWithRepo();
    const taskResult = await getTaskUseCase.execute({ taskId });
    const updatedTask = taskResult.isSuccess ? taskResult.value : null;

    if (!updatedTask) {
      return handleError(Errors.notFound("Task"));
    }

    apiLogger.debug({ taskId }, "Task updated successfully");

    return NextResponse.json(updatedTask);
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm generate error");

    // Clear processing state on error to allow retry
    const clearUseCase = UseCaseFactory.clearProcessingSlot();
    await clearUseCase.execute({
      taskId,
      revertToStatus: task.status,
    });

    return handleError(error);
  }
}
