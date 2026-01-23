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

export const POST = withTask(async (request, { user, task, taskId }) => {
  // This endpoint is for refinement only - task must already have a brainstorm result
  // Initial brainstorming should use /brainstorm/generate instead
  if (!task.brainstormResult) {
    return NextResponse.json(
      { error: "No brainstorm result found. Use /brainstorm/generate first." },
      { status: 400 }
    );
  }

  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  try {
    console.log("[brainstorm/init] Creating AI client for provider:", config.provider);
    const client = await createAIClient(config.provider, config.apiKey, config.model);
    console.log("[brainstorm/init] AI client created successfully");

    // Scan repository via GitHub API for actual context
    let repoContext: RepoContext;
    if (user.encryptedGithubToken && user.githubTokenIv) {
      try {
        const githubToken = decryptGithubToken({
          encrypted: user.encryptedGithubToken,
          iv: user.githubTokenIv,
        });
        const [owner, repoName] = task.repo.fullName.split("/");
        console.log(`[brainstorm/init] Scanning repo: ${task.repo.fullName}`);
        const githubContext = await scanRepoViaGitHub(
          githubToken,
          owner,
          repoName,
          task.repo.defaultBranch || "main"
        );
        console.log(`[brainstorm/init] Tech stack detected: ${githubContext.techStack.join(", ")}`);
        repoContext = {
          techStack: githubContext.techStack,
          fileStructure: githubContext.fileStructure,
          configFiles: githubContext.configFiles,
        };
      } catch (error) {
        console.error("[brainstorm/init] GitHub scan failed:", error);
        repoContext = { techStack: [], fileStructure: [], configFiles: [] };
      }
    } else {
      console.log("[brainstorm/init] No GitHub token, using empty context");
      repoContext = { techStack: [], fileStructure: [], configFiles: [] };
    }

    // Check if conversation already exists in memory
    const existingConversation = getConversation(taskId);
    if (existingConversation && existingConversation.messages.length > 0) {
      console.log("[brainstorm/init] Found existing conversation in memory, returning it");

      // Get the last assistant message to extract options
      const lastAssistantMsg = [...existingConversation.messages]
        .reverse()
        .find(m => m.role === "assistant");

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
      console.log("[brainstorm/init] Found persisted conversation in database, restoring it");
      try {
        const persistedMessages: ChatMessage[] = JSON.parse(task.brainstormConversation);

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
          .find(m => m.role === "assistant");

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
        console.log("[brainstorm/init] Failed to parse persisted conversation:", parseError);
        // Fall through to create new conversation
      }
    }

    // Parse existing brainstorm result for refinement
    // Note: task.brainstormResult is guaranteed to exist due to guard at top of function
    let existingBrainstorm: ExistingBrainstormContext | undefined;
    console.log("[brainstorm/init] Parsing existing brainstorm result for refinement");
    try {
      existingBrainstorm = JSON.parse(task.brainstormResult);
      console.log("[brainstorm/init] Existing brainstorm parsed successfully");
    } catch (parseError) {
      console.log("[brainstorm/init] Failed to parse existing brainstorm:", parseError);
      // If parsing fails, still allow refinement but without context
    }

    // Initialize refinement conversation with AI
    console.log("[brainstorm/init] Starting refinement session");
    const initialResponse = await initializeBrainstorm(
      client,
      task.title,
      task.description,
      repoContext,
      existingBrainstorm
    );
    console.log("[brainstorm/init] initializeBrainstorm completed");

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
    console.error("Brainstorm init error:", error);
    return handleError(error);
  }
});
