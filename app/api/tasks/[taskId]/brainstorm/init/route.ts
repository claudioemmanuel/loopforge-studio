import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createAIClient,
  getDefaultModel,
  initializeBrainstorm,
  setConversation,
  getConversation,
  type RepoContext,
  type ExistingBrainstormContext,
  type ChatMessage,
} from "@/lib/ai";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find configured provider
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
    return NextResponse.json(
      { error: "No AI provider configured. Please add an API key in Settings." },
      { status: 400 }
    );
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return NextResponse.json(
      { error: `API key not configured for ${aiProvider}` },
      { status: 400 }
    );
  }

  try {
    console.log("[brainstorm/init] Decrypting API key for provider:", aiProvider);
    const apiKey = decryptApiKey(encryptedKey);

    console.log("[brainstorm/init] Getting preferred model");
    const model = getPreferredModel(user, aiProvider);
    console.log("[brainstorm/init] Using model:", model);

    console.log("[brainstorm/init] Creating AI client");
    const client = await createAIClient(aiProvider, apiKey, model);
    console.log("[brainstorm/init] AI client created successfully");

    // Default repo context (repository scanning would require local clone)
    // For now, use sensible defaults based on the project type
    const repoContext: RepoContext = {
      techStack: ["Next.js", "React", "TypeScript", "Drizzle ORM"],
      fileStructure: ["app/", "components/", "lib/", "public/"],
      configFiles: ["package.json", "tsconfig.json", "next.config.ts"],
    };

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

        // Update task status if not already brainstorming
        if (task.status !== "brainstorming") {
          await db
            .update(tasks)
            .set({ status: "brainstorming", updatedAt: new Date() })
            .where(eq(tasks.id, taskId));
        }

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

    // Parse existing brainstorm result if present (for refinement)
    let existingBrainstorm: ExistingBrainstormContext | undefined;
    if (task.brainstormResult) {
      console.log("[brainstorm/init] Parsing existing brainstorm result");
      try {
        existingBrainstorm = JSON.parse(task.brainstormResult);
        console.log("[brainstorm/init] Existing brainstorm parsed:", !!existingBrainstorm);
      } catch (parseError) {
        console.log("[brainstorm/init] Failed to parse existing brainstorm:", parseError);
        // If parsing fails, treat as no existing brainstorm
      }
    }

    // Initialize new conversation with AI
    console.log("[brainstorm/init] Calling initializeBrainstorm");
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

    // Update task status
    await db
      .update(tasks)
      .set({ status: "brainstorming", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to start brainstorming. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
