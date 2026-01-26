import { NextResponse } from "next/server";
import {
  createAIClient,
  initializeBrainstorm,
  setConversation,
  getConversation,
  type RepoContext,
  type ExistingBrainstormContext,
  type ChatMessage,
} from "@/lib/ai";
import { decryptGithubToken } from "@/lib/crypto";
import { scanRepoViaGitHub } from "@/lib/github/repo-scanner";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";
import { apiLogger } from "@/lib/logger";

export const POST = withTask(async (request, { user, task, taskId }) => {
  // This endpoint is for refinement only - task must already have a brainstorm result
  // Initial brainstorming should use /brainstorm/generate instead
  if (!task.brainstormResult) {
    return NextResponse.json(
      { error: "No brainstorm result found. Use /brainstorm/generate first." },
      { status: 400 },
    );
  }

  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  try {
    apiLogger.debug({ provider: config.provider }, "Creating AI client");
    const client = await createAIClient(
      config.provider,
      config.apiKey,
      config.model,
    );
    apiLogger.debug("AI client created successfully");

    // Scan repository via GitHub API for actual context
    let repoContext: RepoContext;
    if (user.encryptedGithubToken && user.githubTokenIv) {
      try {
        const githubToken = decryptGithubToken({
          encrypted: user.encryptedGithubToken,
          iv: user.githubTokenIv,
        });
        const [owner, repoName] = task.repo.fullName.split("/");
        apiLogger.debug({ repo: task.repo.fullName }, "Scanning repo");
        const githubContext = await scanRepoViaGitHub(
          githubToken,
          owner,
          repoName,
          task.repo.defaultBranch || "main",
        );
        apiLogger.debug(
          { techStack: githubContext.techStack },
          "Tech stack detected",
        );
        repoContext = {
          techStack: githubContext.techStack,
          fileStructure: githubContext.fileStructure,
          configFiles: githubContext.configFiles,
        };
      } catch (error) {
        apiLogger.error({ error }, "GitHub scan failed");
        repoContext = { techStack: [], fileStructure: [], configFiles: [] };
      }
    } else {
      apiLogger.debug("No GitHub token, using empty context");
      repoContext = { techStack: [], fileStructure: [], configFiles: [] };
    }

    // Check if conversation already exists in memory
    const existingConversation = getConversation(taskId);
    if (existingConversation && existingConversation.messages.length > 0) {
      apiLogger.debug({ taskId }, "Found existing conversation in memory");

      // Get the last assistant message to extract options
      const lastAssistantMsg = [...existingConversation.messages]
        .reverse()
        .find((m) => m.role === "assistant");

      let lastOptions = undefined;
      if (lastAssistantMsg) {
        try {
          const parsed = JSON.parse(lastAssistantMsg.content);
          lastOptions = parsed.options;
        } catch {
          // Content wasn't JSON, that's ok
        }
      }

      return NextResponse.json({
        message: "Continuing your conversation...",
        options: lastOptions,
        brainstormPreview: existingConversation.currentPreview,
        repoContext: {
          techStack: repoContext.techStack,
          fileStructure: repoContext.fileStructure,
        },
        existingMessages: existingConversation.messages,
        isRestored: true,
      });
    }

    // Check if conversation is persisted in database
    if (task.brainstormConversation) {
      apiLogger.debug({ taskId }, "Found persisted conversation in database");
      try {
        const persistedMessages: ChatMessage[] = JSON.parse(
          task.brainstormConversation,
        );

        // Parse existing brainstorm result for the preview
        let currentPreview = undefined;
        if (task.brainstormResult) {
          try {
            currentPreview = JSON.parse(task.brainstormResult);
          } catch {
            // Ignore parse errors
          }
        }

        // Restore conversation to memory
        setConversation(taskId, {
          taskId,
          messages: persistedMessages,
          repoContext,
          currentPreview,
        });

        // Get the last assistant message to extract options
        const lastAssistantMsg = [...persistedMessages]
          .reverse()
          .find((m) => m.role === "assistant");

        let lastOptions = undefined;
        if (lastAssistantMsg) {
          try {
            const parsed = JSON.parse(lastAssistantMsg.content);
            lastOptions = parsed.options;
          } catch {
            // Content wasn't JSON, that's ok
          }
        }

        // Note: Status is already "brainstorming" from /generate endpoint
        // No status change needed here - this is refinement only

        return NextResponse.json({
          message: "Welcome back! Continuing your conversation...",
          options: lastOptions,
          brainstormPreview: currentPreview,
          repoContext: {
            techStack: repoContext.techStack,
            fileStructure: repoContext.fileStructure,
          },
          existingMessages: persistedMessages,
          isRestored: true,
        });
      } catch (parseError) {
        apiLogger.warn(
          { parseError },
          "Failed to parse persisted conversation",
        );
        // Fall through to create new conversation
      }
    }

    // Parse existing brainstorm result for refinement
    // Note: task.brainstormResult is guaranteed to exist due to guard at top of function
    let existingBrainstorm: ExistingBrainstormContext | undefined;
    apiLogger.debug("Parsing existing brainstorm result for refinement");
    try {
      existingBrainstorm = JSON.parse(task.brainstormResult);
      apiLogger.debug("Existing brainstorm parsed successfully");
    } catch (parseError) {
      apiLogger.warn({ parseError }, "Failed to parse existing brainstorm");
      // If parsing fails, still allow refinement but without context
    }

    // Initialize refinement conversation with AI
    apiLogger.debug({ taskId }, "Starting refinement session");
    const initialResponse = await initializeBrainstorm(
      client,
      task.title,
      task.description,
      repoContext,
      existingBrainstorm,
    );
    apiLogger.debug({ taskId }, "initializeBrainstorm completed");

    // Store conversation in memory
    setConversation(taskId, {
      taskId,
      messages: [
        { role: "assistant", content: JSON.stringify(initialResponse) },
      ],
      repoContext,
      currentPreview: initialResponse.brainstormPreview,
    });

    // Note: Status is already "brainstorming" from /generate endpoint
    // No status change needed here - this is refinement only

    return NextResponse.json({
      message: initialResponse.message,
      options: initialResponse.options,
      brainstormPreview: initialResponse.brainstormPreview,
      repoContext: {
        techStack: repoContext.techStack,
        fileStructure: repoContext.fileStructure,
      },
      isRestored: false,
    });
  } catch (error) {
    apiLogger.error({ error }, "Brainstorm init error");
    return handleError(error);
  }
});
