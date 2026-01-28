import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, buildStatusHistoryAppend } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { queueBrainstorm } from "@/lib/queue";
import { decryptApiKey } from "@/lib/crypto";
import {
  publishProcessingEvent,
  createProcessingEvent,
} from "@/lib/workers/events";
import type { AiProvider, User } from "@/lib/db/schema";
import { getDefaultModel } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

// Helper to get API key for a specific provider
function getProviderApiKey(
  user: User,
  provider: AiProvider,
): { encrypted: string; iv: string } | null {
  switch (provider) {
    case "anthropic":
      if (user.encryptedApiKey && user.apiKeyIv) {
        return { encrypted: user.encryptedApiKey, iv: user.apiKeyIv };
      }
      return null;
    case "openai":
      if (user.openaiEncryptedApiKey && user.openaiApiKeyIv) {
        return {
          encrypted: user.openaiEncryptedApiKey,
          iv: user.openaiApiKeyIv,
        };
      }
      return null;
    case "gemini":
      if (user.geminiEncryptedApiKey && user.geminiApiKeyIv) {
        return {
          encrypted: user.geminiEncryptedApiKey,
          iv: user.geminiApiKeyIv,
        };
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
  { params }: { params: Promise<{ taskId: string }> },
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

  // Find a configured provider
  const findConfiguredProvider = (): AiProvider | null => {
    const providers: AiProvider[] = ["anthropic", "openai", "gemini"];

    if (
      user.preferredProvider &&
      getProviderApiKey(user, user.preferredProvider)
    ) {
      return user.preferredProvider;
    }

    for (const provider of providers) {
      if (getProviderApiKey(user, provider)) {
        return provider;
      }
    }

    return null;
  };

  const aiProvider = findConfiguredProvider();
  if (!aiProvider) {
    return handleError(Errors.noProviderConfigured());
  }

  const preferredModel = getPreferredModel(user, aiProvider);
  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return handleError(Errors.authError(aiProvider));
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);
    const startedAt = new Date();

    // ATOMIC: Claim the processing slot first to prevent race conditions
    // This UPDATE only succeeds if processingPhase is NULL
    const claimResult = await db
      .update(tasks)
      .set({
        status: "brainstorming",
        statusHistory: buildStatusHistoryAppend({
          fromStatus: task.status,
          toStatus: "brainstorming",
          triggeredBy: "user",
          userId: session.user.id,
        }),
        processingPhase: "brainstorming",
        processingStartedAt: startedAt,
        processingStatusText: "Analyzing task...",
        updatedAt: startedAt,
      })
      .where(and(eq(tasks.id, taskId), isNull(tasks.processingPhase)))
      .returning({ id: tasks.id });

    // If no rows were updated, another request already claimed the slot
    if (claimResult.length === 0) {
      return NextResponse.json(
        {
          error: "Task is already processing",
          phase: task.processingPhase || "unknown",
        },
        { status: 409 },
      );
    }

    // Now queue the job (we have exclusive processing rights)
    const job = await queueBrainstorm({
      taskId,
      userId: session.user.id,
      repoId: task.repoId,
      apiKey,
      aiProvider,
      preferredModel,
      continueToPlanning: task.autonomousMode,
    });

    // Update with the job ID
    await db
      .update(tasks)
      .set({
        processingJobId: job.id,
      })
      .where(eq(tasks.id, taskId));

    // Publish processing_start event
    const processingEvent = createProcessingEvent(
      "processing_start",
      taskId,
      task.title,
      task.repo.name,
      "brainstorming",
      job.id!,
      startedAt,
      { statusText: "Analyzing task...", progress: 0 },
    );
    await publishProcessingEvent(session.user.id, processingEvent);

    // Return immediately with job info
    return NextResponse.json({
      queued: true,
      jobId: job.id,
      processingPhase: "brainstorming",
    });
  } catch (error) {
    // If queuing failed after claiming, reset the processing state
    await db
      .update(tasks)
      .set({
        status: task.status, // Restore original status
        processingPhase: null,
        processingJobId: null,
        processingStartedAt: null,
        processingStatusText: null,
      })
      .where(eq(tasks.id, taskId));

    apiLogger.error(
      { taskId, provider: aiProvider, error },
      "Failed to queue brainstorm",
    );
    return handleError(error);
  }
}
