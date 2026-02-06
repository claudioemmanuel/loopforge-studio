import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getUserService } from "@/lib/contexts/iam/api";

export async function getSettingsLayoutData(userId: string): Promise<{
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  apiKeyMasked: string | null;
  apiKeys: {
    anthropic: string | null;
    openai: string | null;
    gemini: string | null;
  };
  modelPreferences: {
    anthropic: string;
    openai: string;
    gemini: string;
  };
  preferredProvider: "anthropic" | "openai" | "gemini" | null;
  github: {
    username: string;
    connectedAt: string;
  };
  repos: Array<{
    id: string;
    fullName: string;
    isPrivate: boolean;
  }>;
} | null> {
  const userService = getUserService();
  const repositoryService = getRepositoryService();

  const user = await userService.getUserFull(userId);
  if (!user) {
    return null;
  }

  const userRepos = await repositoryService.listUserRepositories(userId);

  const anthropicKeyMasked = user.encryptedApiKey
    ? "sk-ant-•••••••••••••••"
    : null;
  const openaiKeyMasked = user.openaiEncryptedApiKey
    ? "sk-proj-•••••••••••••••"
    : null;
  const geminiKeyMasked = user.geminiEncryptedApiKey
    ? "AIza•••••••••••••••"
    : null;

  const preferredProvider = ((): "anthropic" | "openai" | "gemini" | null => {
    const pref = user.preferredProvider;
    if (pref === "anthropic" && anthropicKeyMasked) return "anthropic";
    if (pref === "openai" && openaiKeyMasked) return "openai";
    if (pref === "gemini" && geminiKeyMasked) return "gemini";
    if (anthropicKeyMasked) return "anthropic";
    if (openaiKeyMasked) return "openai";
    if (geminiKeyMasked) return "gemini";
    return null;
  })();

  return {
    user: {
      name: user.username,
      email: user.email,
      image: user.avatarUrl,
    },
    apiKeyMasked: anthropicKeyMasked,
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
    preferredProvider,
    github: {
      username: user.username,
      connectedAt: user.createdAt.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    },
    repos: userRepos.map((repo) => ({
      id: repo.id,
      fullName: repo.fullName,
      isPrivate: repo.isPrivate,
    })),
  };
}
