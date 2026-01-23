import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions, userSubscriptions } from "@/lib/db";
import { eq, and, gte, count } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import { decryptApiKey } from "@/lib/crypto";
import type { TaskStatus, AiProvider, User } from "@/lib/db/schema";
import { getDefaultModel } from "@/lib/ai/client";
import { handleError, Errors } from "@/lib/errors";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
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
  }> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.brainstormResult !== undefined) updates.brainstormResult = body.brainstormResult;
  if (body.planContent !== undefined) updates.planContent = body.planContent;
  if (body.branch !== undefined) updates.branch = body.branch;
  if (body.autonomousMode !== undefined) updates.autonomousMode = body.autonomousMode;

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
  const isMovingToExecuting = body.status === "executing" && task.status !== "executing";

  if (isMovingToExecuting) {
    // Validate task has a plan
    if (!task.planContent) {
      return NextResponse.json(
        { error: "Task must have a plan to execute" },
        { status: 400 }
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
    let apiKey: string;
    let finalProvider: AiProvider;
    let finalModel: string;

    // Find a valid provider with an API key configured
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

    if (user.billingMode === "byok") {
      const configuredProvider = findConfiguredProvider();
      if (!configuredProvider) {
        return handleError(Errors.noProviderConfigured());
      }

      const encryptedKey = getProviderApiKey(user, configuredProvider);
      if (!encryptedKey) {
        return handleError(Errors.authError(configuredProvider));
      }

      apiKey = decryptApiKey(encryptedKey);
      finalProvider = configuredProvider;
      finalModel = getPreferredModel(user, configuredProvider);
    } else if (user.billingMode === "managed") {
      // Check subscription status
      const subscription = await db.query.userSubscriptions.findFirst({
        where: and(
          eq(userSubscriptions.userId, session.user.id),
          eq(userSubscriptions.status, "active")
        ),
        with: { plan: true },
      });

      if (!subscription) {
        return NextResponse.json(
          {
            error: "Subscription required",
            code: "SUBSCRIPTION_REQUIRED",
            subscriptionUrl: "/subscription",
          },
          { status: 402 }
        );
      }

      // Check usage against plan limits using COUNT() for efficiency
      const periodStart = subscription.currentPeriodStart;
      const [countResult] = await db
        .select({ count: count() })
        .from(executions)
        .innerJoin(tasks, eq(executions.taskId, tasks.id))
        .where(
          and(
            eq(tasks.repoId, task.repoId),
            gte(executions.createdAt, periodStart),
            eq(executions.status, "completed")
          )
        );

      const taskCount = countResult.count;
      const limit = subscription.plan.taskLimit;
      const graceLimit = Math.floor(limit * (1 + subscription.plan.gracePercent / 100));

      if (taskCount >= graceLimit) {
        return NextResponse.json(
          {
            error: "Task limit exceeded",
            code: "LIMIT_EXCEEDED",
            usage: { current: taskCount, limit, graceLimit },
            upgradeUrl: "/subscription",
          },
          { status: 402 }
        );
      }

      const appApiKey = process.env.APP_ANTHROPIC_API_KEY;
      if (!appApiKey) {
        console.error("APP_ANTHROPIC_API_KEY not configured");
        return NextResponse.json(
          { error: "Service configuration error" },
          { status: 500 }
        );
      }

      apiKey = appApiKey;
      finalProvider = "anthropic";
      finalModel = getPreferredModel(user, "anthropic");
    } else {
      return NextResponse.json(
        {
          error: "Please complete onboarding",
          code: "ONBOARDING_INCOMPLETE",
          onboardingUrl: "/onboarding",
        },
        { status: 400 }
      );
    }

    try {
      // Create execution record
      const executionId = crypto.randomUUID();
      const branch = `loopforge/${task.id.slice(0, 8)}`;

      await db.insert(executions).values({
        id: executionId,
        taskId: task.id,
        status: "queued",
        iteration: 0,
        createdAt: new Date(),
      });

      // Update task status with branch
      updates.branch = branch;

      await db
        .update(tasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

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
      console.error("Execution error:", {
        taskId,
        error,
        timestamp: new Date().toISOString(),
      });

      // Revert status on error
      await db
        .update(tasks)
        .set({ status: task.status, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

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
  { params }: { params: Promise<{ taskId: string }> }
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
