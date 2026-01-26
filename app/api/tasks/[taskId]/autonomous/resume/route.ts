import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";
import { getDefaultModel } from "@/lib/ai/client";
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

// Helper to queue execution for a task with atomic claim
async function queueTaskExecution(
  task: {
    id: string;
    repoId: string;
    planContent: string | null;
    status: string;
    repo: { cloneUrl: string };
  },
  userId: string,
  apiKey: string,
  provider: AiProvider,
  model: string,
) {
  if (!task.planContent) {
    throw new Error("Task must have a plan to execute");
  }

  const branch = `loopforge/${task.id.slice(0, 8)}`;

  // ATOMIC: Claim the execution slot first to prevent race conditions
  // This UPDATE only succeeds if status is NOT 'executing'
  const claimResult = await db
    .update(tasks)
    .set({
      status: "executing",
      branch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tasks.id, task.id),
        ne(tasks.status, "executing"), // Only claim if not already executing
      ),
    )
    .returning({ id: tasks.id });

  // If no rows were updated, another request already started execution
  if (claimResult.length === 0) {
    throw new Error("Task is already executing");
  }

  try {
    // Now create execution record (we have exclusive execution rights)
    const executionId = crypto.randomUUID();
    await db.insert(executions).values({
      id: executionId,
      taskId: task.id,
      status: "queued",
      iteration: 0,
      createdAt: new Date(),
    });

    // Queue the execution job
    const job = await queueExecution({
      executionId,
      taskId: task.id,
      repoId: task.repoId,
      userId,
      apiKey,
      aiProvider: provider,
      preferredModel: model,
      planContent: task.planContent,
      branch,
      cloneUrl: task.repo.cloneUrl,
    });

    return { executionId, jobId: job.id };
  } catch (error) {
    // If queuing failed after claiming, reset the status
    await db
      .update(tasks)
      .set({
        status: task.status as "ready",
        branch: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, task.id),
          eq(tasks.status, "executing"), // Only revert if we set it
        ),
      );
    throw error;
  }
}

/**
 * POST /api/tasks/[taskId]/autonomous/resume
 *
 * Enables autonomous mode and resumes from current stage.
 * - If status === "ready": immediately queue execution
 * - If status === "executing" or "done": return error (can't enable mid-execution)
 * - Otherwise: just set the flag
 */
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

  // Don't allow enabling autonomous mode during execution or after completion
  if (task.status === "executing") {
    return NextResponse.json(
      { error: "Cannot enable autonomous mode while executing" },
      { status: 400 },
    );
  }

  if (task.status === "done") {
    return NextResponse.json(
      { error: "Cannot enable autonomous mode for completed tasks" },
      { status: 400 },
    );
  }

  // If task is "ready", enable autonomous mode AND queue execution atomically
  if (task.status === "ready") {
    // First enable autonomous mode (will be committed with execution claim)
    await db
      .update(tasks)
      .set({ autonomousMode: true, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
    if (!task.planContent) {
      return NextResponse.json(
        { error: "Task must have a plan to execute" },
        { status: 400 },
      );
    }

    // Get user details for API key
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine AI provider and API key based on billing mode
    // Find a valid provider with an API key configured
    const findConfiguredProvider = (): AiProvider | null => {
      const providers: AiProvider[] = ["anthropic", "openai", "gemini"];

      // First try the user's preferred provider
      if (
        user.preferredProvider &&
        getProviderApiKey(user, user.preferredProvider)
      ) {
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

    // BYOK only: User needs at least one API key configured
    const configuredProvider = findConfiguredProvider();
    if (!configuredProvider) {
      return handleError(Errors.noProviderConfigured());
    }

    const encryptedKey = getProviderApiKey(user, configuredProvider);
    if (!encryptedKey) {
      return handleError(Errors.authError(configuredProvider));
    }

    const apiKey = decryptApiKey(encryptedKey);
    const finalProvider = configuredProvider;
    const finalModel = getPreferredModel(user, configuredProvider);

    try {
      const { executionId, jobId } = await queueTaskExecution(
        task,
        session.user.id,
        apiKey,
        finalProvider,
        finalModel,
      );

      const updatedTask = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });

      return NextResponse.json({
        ...updatedTask,
        executionId,
        jobId,
        autoStarted: true,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");

      // Revert status on error
      await db
        .update(tasks)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      return handleError(error);
    }
  }

  // For other statuses, just enable autonomous mode and return
  await db
    .update(tasks)
    .set({ autonomousMode: true, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const updatedTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  return NextResponse.json({
    ...updatedTask,
    autoStarted: false,
  });
}
