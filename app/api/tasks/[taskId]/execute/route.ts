import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, executions, userSubscriptions } from "@/lib/db";
import { eq, and, gte, count, ne } from "drizzle-orm";
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

  if (task.status !== "ready") {
    return NextResponse.json(
      { error: "Task must be in ready status to execute" },
      { status: 400 }
    );
  }

  if (!task.planContent) {
    return NextResponse.json(
      { error: "Task must have a plan to execute" },
      { status: 400 }
    );
  }

  // Get user details
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
    // BYOK: User needs at least one API key configured
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
    // Managed: Check subscription status
    const subscription = await db.query.userSubscriptions.findFirst({
      where: and(
        eq(userSubscriptions.userId, session.user.id),
        eq(userSubscriptions.status, "active")
      ),
      with: { plan: true },
    });

    if (!subscription) {
      // No active subscription - return 402 with subscription URL
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

    // Use app's API key for managed users (always uses Anthropic)
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
    // User hasn't completed onboarding with billing mode
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
    const branch = `loopforge/${task.id.slice(0, 8)}`;

    // ATOMIC: Claim the execution slot first to prevent race conditions
    // This UPDATE only succeeds if status = 'ready' (not already executing)
    const claimResult = await db
      .update(tasks)
      .set({
        status: "executing",
        branch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.status, "ready") // Only claim if still ready
        )
      )
      .returning({ id: tasks.id });

    // If no rows were updated, another request already started execution
    if (claimResult.length === 0) {
      return NextResponse.json(
        { error: "Task is already executing or not in ready status" },
        { status: 409 }
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
    console.error("Execution error:", {
      taskId,
      error,
      timestamp: new Date().toISOString(),
    });

    // Revert status on error (only if we claimed it)
    await db
      .update(tasks)
      .set({ status: "ready", branch: null, updatedAt: new Date() })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.status, "executing") // Only revert if we set it
        )
      );

    return handleError(error);
  }
}
