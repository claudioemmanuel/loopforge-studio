import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { format } from "date-fns";
import { getRepositoryService } from "@/lib/contexts/repository/api";

export const GET = withAuth(async (_request, { user, session }) => {
  const repositoryService = getRepositoryService();
  const allRepos = await repositoryService.listUserRepositories(user.id);

  // Mask API keys – presentation concern, stays in the route
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
    apiKeyMasked: anthropicKeyMasked, // backwards compat
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
    repos: allRepos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      isPrivate: r.isPrivate,
    })),
  });
});
