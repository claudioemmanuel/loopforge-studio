import { decryptApiKey } from "@/lib/crypto";
import { createAIClient, getDefaultModel } from "@/lib/ai";
import type { AiProvider, User } from "@/lib/db/schema";

/**
 * Get encrypted API key for a specific provider
 */
export function getProviderApiKey(
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

/**
 * Get preferred model for a provider
 */
export function getPreferredModel(user: User, provider: AiProvider): string {
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
 * Find first configured AI provider (preferring user's selection)
 */
export function findConfiguredProvider(user: User): AiProvider | null {
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
}

/**
 * AI client configuration including provider, model, and decrypted API key
 */
export interface AIClientConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

/**
 * Get complete AI client configuration for a user
 * Returns null if no provider is configured
 */
export function getAIClientConfig(user: User): AIClientConfig | null {
  const provider = findConfiguredProvider(user);
  if (!provider) return null;

  const encryptedKey = getProviderApiKey(user, provider);
  if (!encryptedKey) return null;

  const apiKey = decryptApiKey(encryptedKey);
  const model = getPreferredModel(user, provider);

  return { provider, model, apiKey };
}

/**
 * Create an AI client from user configuration
 * Returns null if no provider is configured
 */
export async function createUserAIClient(user: User) {
  const config = getAIClientConfig(user);
  if (!config) return null;

  return createAIClient(config.provider, config.apiKey, config.model);
}
