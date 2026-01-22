import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createAIClient,
  getDefaultModel,
  generateInitialBrainstorm,
  type RepoContext,
} from "@/lib/ai";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";
import { handleError, Errors } from "@/lib/errors";
import { queueAutonomousFlow } from "@/lib/queue";

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

/**
 * POST /api/tasks/[taskId]/brainstorm/generate
 *
 * Generates initial brainstorm result without chat interaction.
 * Called when clicking "Start Brainstorming" button.
 * On success: updates task with result, changes status to "brainstorming", returns updated task.
 * On error: returns error, task status remains unchanged.
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

  // Get task with repo
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if autonomous mode is enabled
  if (task.autonomousMode) {
    console.log("[brainstorm/generate] Autonomous mode enabled, queueing autonomous flow");

    // Queue the autonomous flow job
    await queueAutonomousFlow({
      taskId,
      userId: session.user.id,
      repoId: task.repo.id,
    });

    // Update task status to brainstorming immediately
    const [updatedTask] = await db
      .update(tasks)
      .set({
        status: "brainstorming",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return NextResponse.json(updatedTask);
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
    return handleError(Errors.noProviderConfigured());
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return handleError(Errors.authError(aiProvider));
  }

  try {
    console.log("[brainstorm/generate] Decrypting API key for provider:", aiProvider);
    const apiKey = decryptApiKey(encryptedKey);

    console.log("[brainstorm/generate] Getting preferred model");
    const model = getPreferredModel(user, aiProvider);
    console.log("[brainstorm/generate] Using model:", model);

    console.log("[brainstorm/generate] Creating AI client");
    const client = await createAIClient(aiProvider, apiKey, model);
    console.log("[brainstorm/generate] AI client created successfully");

    // Default repo context
    const repoContext: RepoContext = {
      techStack: ["Next.js", "React", "TypeScript", "Drizzle ORM"],
      fileStructure: ["app/", "components/", "lib/", "public/"],
      configFiles: ["package.json", "tsconfig.json", "next.config.ts"],
    };

    // Generate the initial brainstorm
    console.log("[brainstorm/generate] Generating initial brainstorm");
    const brainstormResult = await generateInitialBrainstorm(
      client,
      task.title,
      task.description,
      repoContext
    );
    console.log("[brainstorm/generate] Brainstorm generated successfully");

    // Update task with result and status
    const [updatedTask] = await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(brainstormResult),
        status: "brainstorming",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    console.log("[brainstorm/generate] Task updated successfully");

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Brainstorm generate error:", error);
    return handleError(error);
  }
}
