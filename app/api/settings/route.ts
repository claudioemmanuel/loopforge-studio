import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, repos, tasks, userSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user repos
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, session.user.id),
  });

  // Get subscription if managed user
  let subscription = null;
  if (user.billingMode === "managed") {
    const sub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, session.user.id),
      with: { plan: true },
    });
    if (sub) {
      // Count tasks this period
      const repoIds = userRepos.map(r => r.id);
      const periodTasks = repoIds.length > 0
        ? await db.query.tasks.findMany({
            where: (tasks, { inArray, and, gte }) => and(
              inArray(tasks.repoId, repoIds),
              gte(tasks.createdAt, sub.currentPeriodStart)
            ),
          })
        : [];
      subscription = {
        plan: sub.plan?.displayName || "Unknown",
        usage: periodTasks.filter(t => t.status === "done").length,
        limit: sub.plan?.taskLimit || 30,
        nextBilling: format(sub.currentPeriodEnd, "MMM d, yyyy"),
      };
    }
  }

  // Mask API keys if present
  const anthropicKeyMasked = user.encryptedApiKey
    ? `sk-ant-•••••••••••••${user.encryptedApiKey.slice(-4)}`
    : null;

  const openaiKeyMasked = user.openaiEncryptedApiKey
    ? `sk-•••••••••••••${user.openaiEncryptedApiKey.slice(-4)}`
    : null;

  const geminiKeyMasked = user.geminiEncryptedApiKey
    ? `AIza•••••••••••••${user.geminiEncryptedApiKey.slice(-4)}`
    : null;

  return NextResponse.json({
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    apiKeyMasked: anthropicKeyMasked, // Keep for backwards compatibility
    apiKeys: {
      anthropic: anthropicKeyMasked,
      openai: openaiKeyMasked,
      gemini: geminiKeyMasked,
    },
    modelPreferences: {
      anthropic: user.preferredAnthropicModel || "claude-sonnet-4-20250514",
      openai: user.preferredOpenaiModel || "gpt-4o",
      gemini: user.preferredGeminiModel || "gemini-2.5-pro",
    },
    subscription,
    github: {
      username: user.username,
      connectedAt: format(user.createdAt, "MMMM yyyy"),
    },
    repos: userRepos.map(r => ({
      id: r.id,
      fullName: r.fullName,
      isPrivate: r.isPrivate,
    })),
  });
}
