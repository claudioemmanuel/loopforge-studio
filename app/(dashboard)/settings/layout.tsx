import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, repos, userSubscriptions, subscriptionPlans, usageRecords } from "@/lib/db/schema";
import { eq, and, gte, lte, count } from "drizzle-orm";
import { SettingsProvider } from "./settings-context";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user data
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    redirect("/login");
  }

  // Fetch user repos
  const userRepos = await db
    .select({
      id: repos.id,
      fullName: repos.fullName,
      isPrivate: repos.isPrivate,
    })
    .from(repos)
    .where(eq(repos.userId, session.user.id));

  // Fetch subscription if exists
  let subscriptionData = null;
  const subscription = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.userId, session.user.id),
    with: {
      plan: true,
    },
  });

  if (subscription) {
    // Get usage for current period
    const usageResult = await db
      .select({
        taskCount: count(),
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, session.user.id),
          gte(usageRecords.periodStart, subscription.currentPeriodStart),
          lte(usageRecords.periodStart, subscription.currentPeriodEnd)
        )
      );

    subscriptionData = {
      plan: subscription.plan.displayName,
      usage: usageResult[0]?.taskCount ?? 0,
      limit: subscription.plan.taskLimit,
      nextBilling: subscription.currentPeriodEnd.toLocaleDateString(),
    };
  }

  // Mask API keys if present
  let apiKeyMasked = null;
  if (user.encryptedApiKey) {
    apiKeyMasked = "sk-ant-•••••••••••••••";
  }

  let anthropicKeyMasked = null;
  if (user.encryptedApiKey) {
    anthropicKeyMasked = "sk-ant-•••••••••••••••";
  }

  let openaiKeyMasked = null;
  if (user.openaiEncryptedApiKey) {
    openaiKeyMasked = "sk-proj-•••••••••••••••";
  }

  let geminiKeyMasked = null;
  if (user.geminiEncryptedApiKey) {
    geminiKeyMasked = "AIza•••••••••••••••";
  }

  const settingsData = {
    user: {
      name: user.username,
      email: user.email,
      image: user.avatarUrl,
    },
    apiKeyMasked,
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
    // Only pass preferredProvider if that provider has an API key configured
    preferredProvider: ((): "anthropic" | "openai" | "gemini" | null => {
      const pref = user.preferredProvider;
      if (pref === "anthropic" && anthropicKeyMasked) return "anthropic";
      if (pref === "openai" && openaiKeyMasked) return "openai";
      if (pref === "gemini" && geminiKeyMasked) return "gemini";
      // Fallback to first configured provider
      if (anthropicKeyMasked) return "anthropic";
      if (openaiKeyMasked) return "openai";
      if (geminiKeyMasked) return "gemini";
      // No providers configured
      return null;
    })(),
    subscription: subscriptionData,
    github: {
      username: user.username,
      connectedAt: user.createdAt.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    },
    repos: userRepos,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>
      <SettingsProvider data={settingsData}>{children}</SettingsProvider>
    </div>
  );
}
