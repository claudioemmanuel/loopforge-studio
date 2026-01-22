import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions, userSubscriptions } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";
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

// Helper to queue execution for a task
async function queueTaskExecution(
  task: {
    id: string;
    repoId: string;
    planContent: string | null;
    repo: { cloneUrl: string };
  },
  userId: string,
  apiKey: string,
  provider: AiProvider,
  model: string
) {
  if (!task.planContent) {
    throw new Error("Task must have a plan to execute");
  }

  const executionId = crypto.randomUUID();
  const branch = `loopforge/${task.id.slice(0, 8)}`;

  // Create execution record
  await db.insert(executions).values({
    id: executionId,
    taskId: task.id,
    status: "queued",
    iteration: 0,
    createdAt: new Date(),
  });

  // Update task status
  await db
    .update(tasks)
    .set({
      status: "executing",
      branch,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id));

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

  // Don't allow enabling autonomous mode during execution or after completion
  if (task.status === "executing") {
    return NextResponse.json(
      { error: "Cannot enable autonomous mode while executing" },
      { status: 400 }
    );
  }

  if (task.status === "done") {
    return NextResponse.json(
      { error: "Cannot enable autonomous mode for completed tasks" },
      { status: 400 }
    );
  }

  // Enable autonomous mode
  await db
    .update(tasks)
    .set({ autonomousMode: true, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // If task is "ready", immediately queue execution
  if (task.status === "ready") {
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

      // Check usage against plan limits
      const periodStart = subscription.currentPeriodStart;
      const completedExecutions = await db
        .select()
        .from(executions)
        .innerJoin(tasks, eq(executions.taskId, tasks.id))
        .where(
          and(
            eq(tasks.repoId, task.repoId),
            gte(executions.createdAt, periodStart),
            eq(executions.status, "completed")
          )
        );

      const taskCount = completedExecutions.length;
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
      const { executionId, jobId } = await queueTaskExecution(
        task,
        session.user.id,
        apiKey,
        finalProvider,
        finalModel
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
      console.error("Execution error:", {
        taskId,
        error,
        timestamp: new Date().toISOString(),
      });

      // Revert status on error
      await db
        .update(tasks)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      return handleError(error);
    }
  }

  // For other statuses, just return the updated task
  const updatedTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  return NextResponse.json({
    ...updatedTask,
    autoStarted: false,
  });
}
