/**
 * IAM API Adapters
 *
 * Maps between IAM domain models and API response/request formats.
 * Preserves backward compatibility with existing API contracts.
 */

import type { UserState } from "../domain/user-aggregate";
import type { AIProvider } from "../domain/provider-config";

/**
 * API response format for user
 * Matches existing database schema and frontend expectations
 */
export interface UserApiResponse {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;

  // Provider API keys (encrypted, flattened)
  encryptedApiKey: string | null; // Anthropic (legacy name)
  apiKeyIv: string | null;
  openaiEncryptedApiKey: string | null;
  openaiApiKeyIv: string | null;
  geminiEncryptedApiKey: string | null;
  geminiApiKeyIv: string | null;

  // Preferred models (flattened)
  preferredAnthropicModel: string;
  preferredOpenaiModel: string;
  preferredGeminiModel: string;
  preferredProvider: AIProvider;

  // GitHub token (encrypted)
  encryptedGithubToken: string | null;
  githubTokenIv: string | null;

  // User preferences
  onboardingCompleted: boolean;
  locale: string;
  defaultCloneDirectory: string | null;
  defaultTestCommand: string | null;
  defaultTestTimeout: number | null;
  defaultTestGatePolicy: string | null;

  // Billing
  billingMode: string;
  subscriptionTier: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API request format for updating user settings
 */
export interface UserSettingsRequest {
  preferredProvider?: AIProvider;
  preferredAnthropicModel?: string;
  preferredOpenaiModel?: string;
  preferredGeminiModel?: string;
  locale?: string;
  defaultCloneDirectory?: string;
  defaultTestCommand?: string;
  defaultTestTimeout?: number;
  defaultTestGatePolicy?: string;
}

/**
 * API request format for configuring provider API key
 */
export interface ProviderApiKeyRequest {
  provider: AIProvider;
  apiKey: string; // Plaintext (will be encrypted by service)
  preferredModel?: string;
}

/**
 * User adapter - maps between domain and API formats
 */
export class UserAdapter {
  /**
   * Convert domain state to API response format
   *
   * Flattens nested provider configuration to match existing API contract.
   * Frontend expects flat structure with legacy field names.
   */
  static toApiResponse(
    state: UserState,
    additionalData?: {
      encryptedGithubToken?: string | null;
      githubTokenIv?: string | null;
      defaultCloneDirectory?: string | null;
      defaultTestCommand?: string | null;
      defaultTestTimeout?: number | null;
      defaultTestGatePolicy?: string | null;
      billingMode?: string;
      subscriptionTier?: string | null;
    },
  ): UserApiResponse {
    return {
      // Identity
      id: state.id,
      githubId: state.githubId,
      username: state.username,
      email: state.email ?? null,
      avatarUrl: state.avatarUrl ?? null,

      // Anthropic API key (legacy flat structure)
      encryptedApiKey: state.encryptedApiKey ?? null,
      apiKeyIv: state.apiKeyIv ?? null,

      // OpenAI API key (flat structure)
      openaiEncryptedApiKey: state.openaiEncryptedApiKey ?? null,
      openaiApiKeyIv: state.openaiApiKeyIv ?? null,

      // Gemini API key (flat structure)
      geminiEncryptedApiKey: state.geminiEncryptedApiKey ?? null,
      geminiApiKeyIv: state.geminiApiKeyIv ?? null,

      // Preferred models (flattened)
      preferredAnthropicModel:
        state.preferredAnthropicModel ?? "claude-sonnet-4-20250514",
      preferredOpenaiModel: state.preferredOpenaiModel ?? "gpt-4o",
      preferredGeminiModel: state.preferredGeminiModel ?? "gemini-2.5-pro",
      preferredProvider: state.preferredProvider ?? "anthropic",

      // GitHub token (from additional data)
      encryptedGithubToken:
        additionalData?.encryptedGithubToken ??
        state.encryptedGithubToken ??
        null,
      githubTokenIv:
        additionalData?.githubTokenIv ?? state.githubTokenIv ?? null,

      // User preferences
      onboardingCompleted: state.onboardingCompleted,
      locale: state.locale,
      defaultCloneDirectory:
        additionalData?.defaultCloneDirectory ??
        state.defaultCloneDirectory ??
        null,
      defaultTestCommand:
        additionalData?.defaultTestCommand ?? state.defaultTestCommand ?? null,
      defaultTestTimeout:
        additionalData?.defaultTestTimeout ?? state.defaultTestTimeout ?? null,
      defaultTestGatePolicy:
        additionalData?.defaultTestGatePolicy ??
        state.defaultTestGatePolicy ??
        null,

      // Billing (from additional data)
      billingMode: additionalData?.billingMode ?? state.billingMode ?? "byok",
      subscriptionTier:
        additionalData?.subscriptionTier ?? state.subscriptionTier ?? null,

      // Timestamps
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  /**
   * Convert API settings request to partial user state
   *
   * Extracts only the fields that can be updated through settings.
   * Only includes provided fields (partial update support).
   */
  static fromSettingsRequest(body: UserSettingsRequest): {
    locale?: string;
    preferredProvider?: AIProvider;
    preferredAnthropicModel?: string;
    preferredOpenaiModel?: string;
    preferredGeminiModel?: string;
  } {
    const result: {
      locale?: string;
      preferredProvider?: AIProvider;
      preferredAnthropicModel?: string;
      preferredOpenaiModel?: string;
      preferredGeminiModel?: string;
    } = {};

    // Locale
    if (body.locale !== undefined) {
      result.locale = body.locale;
    }

    // Provider configuration updates
    if (body.preferredProvider !== undefined) {
      result.preferredProvider = body.preferredProvider;
    }

    // Model updates (partial)
    if (body.preferredAnthropicModel !== undefined) {
      result.preferredAnthropicModel = body.preferredAnthropicModel;
    }
    if (body.preferredOpenaiModel !== undefined) {
      result.preferredOpenaiModel = body.preferredOpenaiModel;
    }
    if (body.preferredGeminiModel !== undefined) {
      result.preferredGeminiModel = body.preferredGeminiModel;
    }

    return result;
  }

  /**
   * Convert flat database row to domain UserState
   *
   * Used when loading user from database during migration.
   * Maps flat API key columns to nested providerConfiguration structure.
   */
  static fromDatabaseRow(row: {
    id: string;
    githubId: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
    encryptedApiKey?: string | null;
    apiKeyIv?: string | null;
    openaiEncryptedApiKey?: string | null;
    openaiApiKeyIv?: string | null;
    geminiEncryptedApiKey?: string | null;
    geminiApiKeyIv?: string | null;
    preferredAnthropicModel?: string | null;
    preferredOpenaiModel?: string | null;
    preferredGeminiModel?: string | null;
    preferredProvider?: AIProvider;
    encryptedGithubToken?: string | null;
    githubTokenIv?: string | null;
    defaultCloneDirectory?: string | null;
    defaultTestCommand?: string | null;
    defaultTestTimeout?: number | null;
    defaultTestGatePolicy?: "strict" | "warn" | "skip" | "autoApprove" | null;
    subscriptionTier?: "free" | "pro" | "enterprise" | null;
    billingMode?: "byok" | "managed" | null;
    subscriptionStatus?: "active" | "canceled" | "past_due" | null;
    subscriptionPeriodEnd?: Date | null;
    stripeCustomerId?: string | null;
    onboardingCompleted?: boolean;
    locale?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserState {
    return {
      id: row.id,
      githubId: row.githubId,
      username: row.username,
      email: row.email ?? null,
      avatarUrl: row.avatarUrl ?? null,
      encryptedGithubToken: row.encryptedGithubToken ?? null,
      githubTokenIv: row.githubTokenIv ?? null,
      preferredProvider: row.preferredProvider ?? null,
      encryptedApiKey: row.encryptedApiKey ?? null,
      apiKeyIv: row.apiKeyIv ?? null,
      preferredAnthropicModel: row.preferredAnthropicModel ?? null,
      openaiEncryptedApiKey: row.openaiEncryptedApiKey ?? null,
      openaiApiKeyIv: row.openaiApiKeyIv ?? null,
      preferredOpenaiModel: row.preferredOpenaiModel ?? null,
      geminiEncryptedApiKey: row.geminiEncryptedApiKey ?? null,
      geminiApiKeyIv: row.geminiApiKeyIv ?? null,
      preferredGeminiModel: row.preferredGeminiModel ?? null,
      defaultCloneDirectory: row.defaultCloneDirectory ?? null,
      defaultTestCommand: row.defaultTestCommand ?? null,
      defaultTestTimeout: row.defaultTestTimeout ?? null,
      defaultTestGatePolicy: row.defaultTestGatePolicy ?? null,
      subscriptionTier: row.subscriptionTier ?? "free",
      billingMode: row.billingMode ?? "byok",
      subscriptionStatus: row.subscriptionStatus ?? "active",
      subscriptionPeriodEnd: row.subscriptionPeriodEnd ?? null,
      stripeCustomerId: row.stripeCustomerId ?? null,
      onboardingCompleted: row.onboardingCompleted ?? false,
      locale: row.locale ?? "en",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
