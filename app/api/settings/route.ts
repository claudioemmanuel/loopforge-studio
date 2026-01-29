import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, repos } from "@/lib/db";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { handleError, Errors } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Fetch user data
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return handleError(Errors.notFound("User"));
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
    github: {
      username: user.username,
      connectedAt: format(user.createdAt, "MMMM yyyy"),
    },
    repos: userRepos,
  });
}
