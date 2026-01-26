import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions } from "@/lib/db";
import { eq, and, ne } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import { decryptApiKey } from "@/lib/crypto";
import type {
  TaskStatus,
  AiProvider,
  User,
  StatusHistoryEntry,
} from "@/lib/db/schema";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(
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

  const body = await request.json();
  const updates: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: number;
    brainstormResult: string | null;
    planContent: string | null;
    branch: string;
    autonomousMode: boolean;
    statusHistory: StatusHistoryEntry[];
  }> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.brainstormResult !== undefined)
    updates.brainstormResult = body.brainstormResult;
  if (body.planContent !== undefined) updates.planContent = body.planContent;
  if (body.branch !== undefined) updates.branch = body.branch;
  if (body.autonomousMode !== undefined)
    updates.autonomousMode = body.autonomousMode;

  // Record status change in history
  if (body.status !== undefined && body.status !== task.status) {
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: body.status as TaskStatus,
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: session.user.id,
    };
    updates.statusHistory = [...(task.statusHistory || []), historyEntry];
  }

  // Handle backward movement with resetPhases option
  // When moving backward and resetPhases is true, clear data based on target status
  if (body.resetPhases === true && body.status !== undefined) {
    const targetStatus = body.status as TaskStatus;

    // Reset logic based on target status:
    // - Moving to "todo": clear brainstormResult and planContent
    // - Moving to "brainstorming": clear planContent
    if (targetStatus === "todo") {
      updates.brainstormResult = null;
      updates.planContent = null;
    } else if (targetStatus === "brainstorming") {
      updates.planContent = null;
    }
  }

  // Check if status is changing to "executing" - auto-queue execution
  const isMovingToExecuting =
    body.status === "executing" && task.status !== "executing";

  if (isMovingToExecuting) {
    // Validate task has a plan
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
      const branch = `loopforge/${task.id.slice(0, 8)}`;
      updates.branch = branch;

      // ATOMIC: Claim the execution slot first to prevent race conditions
      // This UPDATE only succeeds if status is NOT 'executing' (not already running)
      const claimResult = await db
        .update(tasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.id, taskId),
            ne(tasks.status, "executing"), // Only claim if not already executing
          ),
        )
        .returning({ id: tasks.id });

      // If no rows were updated, another request already started execution
      if (claimResult.length === 0) {
        return NextResponse.json(
          { error: "Task is already executing" },
          { status: 409 },
        );
      }

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
        userId: session.user.id,
        apiKey,
        aiProvider: finalProvider,
        preferredModel: finalModel,
        planContent: task.planContent,
        branch,
        cloneUrl: task.repo.cloneUrl,
      });

      const updatedTask = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });

      return NextResponse.json({
        ...updatedTask,
        executionId,
        jobId: job.id,
      });
    } catch (error) {
      apiLogger.error({ taskId, error }, "Execution error");

      // Revert status on error (only if we set it to executing)
      await db
        .update(tasks)
        .set({ status: task.status, branch: null, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.status, "executing"), // Only revert if we set it
          ),
        );

      return handleError(error);
    }
  }

  // Standard update (not moving to executing)
  await db
    .update(tasks)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const updatedTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  return NextResponse.json(updatedTask);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(tasks).where(eq(tasks.id, taskId));

  return NextResponse.json({ success: true });
}
