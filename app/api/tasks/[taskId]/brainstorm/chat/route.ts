import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createAIClient,
  getConversation,
  setConversation,
  chatWithAI,
  type RepoContext,
  type ExistingBrainstormContext,
} from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import {
  findConfiguredProvider,
  getProviderApiKey,
  getPreferredModel,
} from "@/lib/api";
import { decryptApiKey } from "@/lib/crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body early (before other checks) since we need it
  const body = await request.json();
  const { message, choice } = body as { message?: string; choice?: string };

  if (!message && !choice) {
    return NextResponse.json(
      { error: "Message or choice is required" },
      { status: 400 }
    );
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get existing conversation or restore from database/re-initialize
  let conversation = getConversation(taskId);
  if (!conversation) {
    console.log("[brainstorm/chat] No conversation in memory, checking database...");

    // Re-create conversation from task context
    const repoContext: RepoContext = {
      techStack: ["Next.js", "React", "TypeScript", "Drizzle ORM"],
      fileStructure: ["app/", "components/", "lib/", "public/"],
      configFiles: ["package.json", "tsconfig.json", "next.config.ts"],
    };

    // Try to restore from database first
    if (task.brainstormConversation) {
      console.log("[brainstorm/chat] Found persisted conversation, restoring...");
      try {
        const persistedMessages = JSON.parse(task.brainstormConversation);
        let existingBrainstorm: ExistingBrainstormContext | undefined;
        if (task.brainstormResult) {
          try {
            existingBrainstorm = JSON.parse(task.brainstormResult);
          } catch {
            // Ignore parse errors
          }
        }

        conversation = {
          taskId,
          messages: persistedMessages,
          repoContext,
          currentPreview: existingBrainstorm,
        };
        setConversation(taskId, conversation);
      } catch {
        console.log("[brainstorm/chat] Failed to parse persisted conversation, creating new");
      }
    }

    // If still no conversation, create a fresh one
    if (!conversation) {
      console.log("[brainstorm/chat] Creating new conversation...");
      let existingBrainstorm: ExistingBrainstormContext | undefined;
      if (task.brainstormResult) {
        try {
          existingBrainstorm = JSON.parse(task.brainstormResult);
        } catch {
          // If parsing fails, treat as no existing brainstorm
        }
      }

      conversation = {
        taskId,
        messages: [],
        repoContext,
        currentPreview: existingBrainstorm,
      };
      setConversation(taskId, conversation);
    }
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find configured provider using shared helper
  const aiProvider = findConfiguredProvider(user);
  if (!aiProvider) {
    return handleError(Errors.noProviderConfigured());
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return handleError(Errors.authError(aiProvider));
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);
    const model = getPreferredModel(user, aiProvider);
    const client = await createAIClient(aiProvider, apiKey, model);

    // Build user message
    const userMessage = choice
      ? `I choose: ${choice}`
      : message || "";

    // Add user message to conversation
    conversation.messages.push({ role: "user", content: userMessage });

    // Get AI response (pass task title to keep AI focused on the original task)
    const response = await chatWithAI(client, conversation, userMessage, task.title);

    // Add AI response to conversation
    conversation.messages.push({
      role: "assistant",
      content: JSON.stringify(response),
    });

    // Update preview if provided
    if (response.brainstormPreview) {
      conversation.currentPreview = response.brainstormPreview;
    }

    // Save updated conversation to memory
    setConversation(taskId, conversation);

    // Persist to database - MUST await to prevent data loss
    // Previous fire-and-forget pattern could lose conversation on server restart
    await db.update(tasks)
      .set({
        brainstormConversation: JSON.stringify(conversation.messages),
        brainstormResult: conversation.currentPreview
          ? JSON.stringify(conversation.currentPreview, null, 2)
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return NextResponse.json({
      message: response.message,
      options: response.options,
      brainstormPreview: response.brainstormPreview,
      suggestComplete: response.suggestComplete,
    });
  } catch (error) {
    console.error("Brainstorm chat error:", error);
    return handleError(error);
  }
}
