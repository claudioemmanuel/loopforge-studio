/**
 * IAM Public API
 *
 * Backward-compatible API for the IAM context.
 * This provides the same interface as the old lib/api/helpers.ts functions.
 */

import { Redis } from "ioredis";
import { UserService } from "../application/user-service";
import type { AIProvider } from "../domain/provider-config";
import { createAIClient, getDefaultModel } from "@/lib/ai";
import type { User } from "@/lib/db/schema";

// Singleton Redis instance for IAM context
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(
      process.env.REDIS_URL || "redis://localhost:6379",
    );
  }
  return redisInstance;
}

// Singleton UserService instance
let userServiceInstance: UserService | null = null;

function getUserService(): UserService {
  if (!userServiceInstance) {
    userServiceInstance = new UserService(getRedis());
  }
  return userServiceInstance;
}

/**
 * AI client configuration including provider, model, and decrypted API key
 */
export interface AIClientConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/**
 * Get complete AI client configuration for a user
 * Returns null if no provider is configured
 *
 * This is a backward-compatible wrapper around UserService.getUserProviderConfig
 */
export async function getAIClientConfig(
  user: User,
): Promise<AIClientConfig | null> {
  const service = getUserService();
  return await service.getUserProviderConfig(user.id);
}

/**
 * Create an AI client from user configuration
 * Returns null if no provider is configured
 */
export async function createUserAIClient(user: User) {
  const config = await getAIClientConfig(user);
  if (!config) return null;

  return await createAIClient(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
  });
}

/**
 * Get encrypted API key for a specific provider (legacy function)
 *
 * Note: This function is kept for backward compatibility but should be avoided.
 * Use UserService.getProviderApiKey instead for new code.
 */
export function getProviderApiKey(
  user: User,
  provider: AIProvider,
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
 * Get preferred model for a provider (legacy function)
 */
export function getPreferredModel(user: User, provider: AIProvider): string {
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
 * Find first configured AI provider (preferring user's selection) (legacy function)
 */
export function findConfiguredProvider(user: User): AIProvider | null {
  const providers: AIProvider[] = ["anthropic", "openai", "gemini"];

  // First try the user's preferred provider
  if (
    user.preferredProvider &&
    getProviderApiKey(user, user.preferredProvider)
  ) {
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
 * Export UserService for direct access (new code should use this)
 */
export { UserService };

/**
 * Export domain types
 */
export type { AIProvider };
export type { UserState } from "../domain/user-aggregate";
export type { UserProviderConfiguration } from "../domain/provider-config";
