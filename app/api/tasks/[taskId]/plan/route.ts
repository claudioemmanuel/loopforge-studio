import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generatePlan, createAIClient, getDefaultModel } from "@/lib/ai";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";

// Helper to get API key for a specific provider
function getProviderApiKey(
  user: User,
  provider: AiProvider
): { encrypted: string; iv: string } | null {
  switch (provider) {
    case "anthropic":
      if (user.encryptedApiKey && user.apiKeyIv) {
        return { encrypted: user.encryptedApiKey, iv: user.apiKeyIv };
      }
      return null;
    case "openai":
      if (user.openaiEncryptedApiKey && user.openaiApiKeyIv) {
        return { encrypted: user.openaiEncryptedApiKey, iv: user.openaiApiKeyIv };
      }
      return null;
    case "gemini":
      if (user.geminiEncryptedApiKey && user.geminiApiKeyIv) {
        return { encrypted: user.geminiEncryptedApiKey, iv: user.geminiApiKeyIv };
      }
      return null;
    default:
      return null;
  }
}

// Helper to get preferred model for a provider
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

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get user's details
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find a configured provider (prefer user's selection, fall back to any configured)
  const findConfiguredProvider = (): AiProvider | null => {
    const providers: AiProvider[] = ["anthropic", "openai", "gemini"];

    // First try the user's preferred provider
    if (user.preferredProvider && getProviderApiKey(user, user.preferredProvider)) {
      return user.preferredProvider;
    }

    // Fall back to any configured provider
    for (const provider of providers) {
      if (getProviderApiKey(user, provider)) {
        return provider;
      }
    }

    return null;
  };

  const aiProvider = findConfiguredProvider();
  if (!aiProvider) {
    return NextResponse.json(
      {
        error: "No AI provider configured. Please add an API key in Settings.",
        code: "NO_PROVIDER_CONFIGURED",
      },
      { status: 400 }
    );
  }

  const preferredModel = getPreferredModel(user, aiProvider);
  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return NextResponse.json(
      {
        error: `API key not configured for ${aiProvider}`,
        code: "API_KEY_NOT_CONFIGURED",
        provider: aiProvider,
      },
      { status: 400 }
    );
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);
    const client = await createAIClient(aiProvider, apiKey, preferredModel);

    // Update status to planning
    await db
      .update(tasks)
      .set({ status: "planning", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Generate plan
    const result = await generatePlan(
      client,
      task.title,
      task.description,
      task.brainstormResult
    );

    // Update task with result
    await db
      .update(tasks)
      .set({
        planContent: JSON.stringify(result, null, 2),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Enhanced error logging with full context
    console.error("Plan generation error:", {
      taskId,
      provider: aiProvider,
      model: preferredModel,
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    // Revert status on error
    await db
      .update(tasks)
      .set({ status: "brainstorming", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Check if error is related to API key
    const isApiKeyError =
      errorMessage.toLowerCase().includes("api key") ||
      errorMessage.includes("API_KEY") ||
      errorMessage.toLowerCase().includes("invalid api") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("authentication") ||
      errorMessage.includes("401");

    if (isApiKeyError) {
      return NextResponse.json(
        {
          error: "Invalid or missing API key. Please check your API key in Settings > Integrations.",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
        { status: 401 }
      );
    }

    // Return more informative error in development
    return NextResponse.json(
      {
        error: "Failed to generate plan. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
