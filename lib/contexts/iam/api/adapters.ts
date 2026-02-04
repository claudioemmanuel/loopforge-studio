/**
 * IAM API Adapters
 *
 * Maps between IAM domain models and API response/request formats.
 * Preserves backward compatibility with existing API contracts.
 */

import type { UserState } from "../domain/user-aggregate";
import type {
  AIProvider,
  EncryptedApiKey,
  UserProviderConfiguration,
} from "../domain/provider-config";

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
    const config = state.providerConfiguration;

    return {
      // Identity
      id: state.id,
      githubId: state.githubId,
      username: state.username,
      email: state.email ?? null,
      avatarUrl: state.avatarUrl ?? null,

      // Anthropic API key (legacy flat structure)
      encryptedApiKey: config.anthropic.apiKey?.encryptedValue ?? null,
      apiKeyIv: config.anthropic.apiKey?.iv ?? null,

      // OpenAI API key (flat structure)
      openaiEncryptedApiKey: config.openai.apiKey?.encryptedValue ?? null,
      openaiApiKeyIv: config.openai.apiKey?.iv ?? null,

      // Gemini API key (flat structure)
      geminiEncryptedApiKey: config.gemini.apiKey?.encryptedValue ?? null,
      geminiApiKeyIv: config.gemini.apiKey?.iv ?? null,

      // Preferred models (flattened)
      preferredAnthropicModel: config.anthropic.preferredModel,
      preferredOpenaiModel: config.openai.preferredModel,
      preferredGeminiModel: config.gemini.preferredModel,
      preferredProvider: config.preferredProvider,

      // GitHub token (from additional data)
      encryptedGithubToken: additionalData?.encryptedGithubToken ?? null,
      githubTokenIv: additionalData?.githubTokenIv ?? null,

      // User preferences
      onboardingCompleted: state.onboardingCompleted,
      locale: state.locale,
      defaultCloneDirectory: additionalData?.defaultCloneDirectory ?? null,
      defaultTestCommand: additionalData?.defaultTestCommand ?? null,
      defaultTestTimeout: additionalData?.defaultTestTimeout ?? null,
      defaultTestGatePolicy: additionalData?.defaultTestGatePolicy ?? null,

      // Billing (from additional data)
      billingMode: additionalData?.billingMode ?? "byok",
      subscriptionTier: additionalData?.subscriptionTier ?? null,

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
    providerConfiguration?: Partial<UserProviderConfiguration>;
  } {
    const result: {
      locale?: string;
      providerConfiguration?: Partial<UserProviderConfiguration>;
    } = {};

    // Locale
    if (body.locale !== undefined) {
      result.locale = body.locale;
    }

    // Provider configuration updates
    const providerUpdates: Partial<UserProviderConfiguration> = {};

    if (body.preferredProvider !== undefined) {
      providerUpdates.preferredProvider = body.preferredProvider;
    }

    // Model updates (partial)
    if (
      body.preferredAnthropicModel !== undefined ||
      body.preferredOpenaiModel !== undefined ||
      body.preferredGeminiModel !== undefined
    ) {
      if (body.preferredAnthropicModel !== undefined) {
        providerUpdates.anthropic = {
          provider: "anthropic",
          apiKey: null, // Don't update key here
          preferredModel: body.preferredAnthropicModel,
        };
      }

      if (body.preferredOpenaiModel !== undefined) {
        providerUpdates.openai = {
          provider: "openai",
          apiKey: null,
          preferredModel: body.preferredOpenaiModel,
        };
      }

      if (body.preferredGeminiModel !== undefined) {
        providerUpdates.gemini = {
          provider: "gemini",
          apiKey: null,
          preferredModel: body.preferredGeminiModel,
        };
      }
    }

    if (Object.keys(providerUpdates).length > 0) {
      result.providerConfiguration = providerUpdates;
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
    onboardingCompleted?: boolean;
    locale?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserState {
    // Build encrypted API keys
    const anthropicKey: EncryptedApiKey | null =
      row.encryptedApiKey && row.apiKeyIv
        ? { encryptedValue: row.encryptedApiKey, iv: row.apiKeyIv }
        : null;

    const openaiKey: EncryptedApiKey | null =
      row.openaiEncryptedApiKey && row.openaiApiKeyIv
        ? {
            encryptedValue: row.openaiEncryptedApiKey,
            iv: row.openaiApiKeyIv,
          }
        : null;

    const geminiKey: EncryptedApiKey | null =
      row.geminiEncryptedApiKey && row.geminiApiKeyIv
        ? {
            encryptedValue: row.geminiEncryptedApiKey,
            iv: row.geminiApiKeyIv,
          }
        : null;

    // Build provider configuration
    const providerConfiguration: UserProviderConfiguration = {
      anthropic: {
        provider: "anthropic",
        apiKey: anthropicKey,
        preferredModel:
          row.preferredAnthropicModel ?? "claude-sonnet-4-20250514",
      },
      openai: {
        provider: "openai",
        apiKey: openaiKey,
        preferredModel: row.preferredOpenaiModel ?? "gpt-4o",
      },
      gemini: {
        provider: "gemini",
        apiKey: geminiKey,
        preferredModel: row.preferredGeminiModel ?? "gemini-2.5-pro",
      },
      preferredProvider: row.preferredProvider ?? "anthropic",
    };

    return {
      id: row.id,
      githubId: row.githubId,
      username: row.username,
      email: row.email ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      providerConfiguration,
      onboardingCompleted: row.onboardingCompleted ?? false,
      locale: row.locale ?? "en",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
