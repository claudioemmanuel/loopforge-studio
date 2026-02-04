/**
 * Provider Configuration Value Object
 *
 * Represents the configuration for an AI provider (API key, preferred model).
 */

export type AIProvider = "anthropic" | "openai" | "gemini";

/**
 * Encrypted API key with initialization vector
 */
export interface EncryptedApiKey {
  encryptedValue: string;
  iv: string;
}

/**
 * Provider configuration for a single AI provider
 */
export interface ProviderConfig {
  provider: AIProvider;
  apiKey: EncryptedApiKey | null;
  preferredModel: string;
}

/**
 * Complete user provider configuration (all 3 providers)
 */
export interface UserProviderConfiguration {
  anthropic: ProviderConfig;
  openai: ProviderConfig;
  gemini: ProviderConfig;
  preferredProvider: AIProvider;
}

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.5-pro",
};

/**
 * Check if provider has valid API key
 */
export function hasValidApiKey(config: ProviderConfig): boolean {
  return (
    config.apiKey !== null &&
    config.apiKey.encryptedValue.length > 0 &&
    config.apiKey.iv.length > 0
  );
}

/**
 * Get the active provider configuration (the one user prefers)
 */
export function getActiveProviderConfig(
  config: UserProviderConfiguration,
): ProviderConfig {
  return config[config.preferredProvider];
}

/**
 * Check if user has at least one configured provider
 */
export function hasAtLeastOneProvider(
  config: UserProviderConfiguration,
): boolean {
  return (
    hasValidApiKey(config.anthropic) ||
    hasValidApiKey(config.openai) ||
    hasValidApiKey(config.gemini)
  );
}
