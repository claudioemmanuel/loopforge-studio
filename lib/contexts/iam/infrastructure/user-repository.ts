/**
 * User Repository
 *
 * Handles persistence and retrieval of User aggregates.
 * Translates between database schema and domain model.
 */

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import { UserAggregate, type UserState } from "../domain/user-aggregate";
import type {
  AIProvider,
  UserProviderConfiguration,
} from "../domain/provider-config";
import { DEFAULT_MODELS } from "../domain/provider-config";

/**
 * Database row type for IAM-related columns only
 */
type UserRow = {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  encryptedApiKey: string | null;
  apiKeyIv: string | null;
  openaiEncryptedApiKey: string | null;
  openaiApiKeyIv: string | null;
  geminiEncryptedApiKey: string | null;
  geminiApiKeyIv: string | null;
  preferredAnthropicModel: string | null;
  preferredOpenaiModel: string | null;
  preferredGeminiModel: string | null;
  preferredProvider: string | null;
  onboardingCompleted: boolean | null;
  locale: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * User repository for database operations
 */
export class UserRepository {
  constructor(private redis: Redis) {}

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<UserAggregate | null> {
    const rows = await db
      .select({
        id: users.id,
        githubId: users.githubId,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        encryptedApiKey: users.encryptedApiKey,
        apiKeyIv: users.apiKeyIv,
        openaiEncryptedApiKey: users.openaiEncryptedApiKey,
        openaiApiKeyIv: users.openaiApiKeyIv,
        geminiEncryptedApiKey: users.geminiEncryptedApiKey,
        geminiApiKeyIv: users.geminiApiKeyIv,
        preferredAnthropicModel: users.preferredAnthropicModel,
        preferredOpenaiModel: users.preferredOpenaiModel,
        preferredGeminiModel: users.preferredGeminiModel,
        preferredProvider: users.preferredProvider,
        onboardingCompleted: users.onboardingCompleted,
        locale: users.locale,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (rows.length === 0) {
      return null;
    }

    const state = this.mapRowToState(rows[0]);
    return new UserAggregate(state, this.redis);
  }

  /**
   * Find user by GitHub ID
   */
  async findByGithubId(githubId: string): Promise<UserAggregate | null> {
    const rows = await db
      .select({
        id: users.id,
        githubId: users.githubId,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        encryptedApiKey: users.encryptedApiKey,
        apiKeyIv: users.apiKeyIv,
        openaiEncryptedApiKey: users.openaiEncryptedApiKey,
        openaiApiKeyIv: users.openaiApiKeyIv,
        geminiEncryptedApiKey: users.geminiEncryptedApiKey,
        geminiApiKeyIv: users.geminiApiKeyIv,
        preferredAnthropicModel: users.preferredAnthropicModel,
        preferredOpenaiModel: users.preferredOpenaiModel,
        preferredGeminiModel: users.preferredGeminiModel,
        preferredProvider: users.preferredProvider,
        onboardingCompleted: users.onboardingCompleted,
        locale: users.locale,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.githubId, githubId));

    if (rows.length === 0) {
      return null;
    }

    const state = this.mapRowToState(rows[0]);
    return new UserAggregate(state, this.redis);
  }

  /**
   * Save user aggregate to database
   */
  async save(user: UserAggregate): Promise<void> {
    const state = user.getState();
    const row = this.mapStateToRow(state);

    // Check if user exists (only select id column)
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, state.id));

    if (existing.length === 0) {
      // Insert new user
      await db.insert(users).values(row);
    } else {
      // Update existing user
      await db.update(users).set(row).where(eq(users.id, state.id));
    }
  }

  /**
   * Map database row to domain state
   */
  private mapRowToState(row: UserRow): UserState {
    // Build provider configuration
    const providerConfiguration: UserProviderConfiguration = {
      anthropic: {
        provider: "anthropic",
        apiKey:
          row.encryptedApiKey && row.apiKeyIv
            ? {
                encryptedValue: row.encryptedApiKey,
                iv: row.apiKeyIv,
              }
            : null,
        preferredModel: row.preferredAnthropicModel || DEFAULT_MODELS.anthropic,
      },
      openai: {
        provider: "openai",
        apiKey:
          row.openaiEncryptedApiKey && row.openaiApiKeyIv
            ? {
                encryptedValue: row.openaiEncryptedApiKey,
                iv: row.openaiApiKeyIv,
              }
            : null,
        preferredModel: row.preferredOpenaiModel || DEFAULT_MODELS.openai,
      },
      gemini: {
        provider: "gemini",
        apiKey:
          row.geminiEncryptedApiKey && row.geminiApiKeyIv
            ? {
                encryptedValue: row.geminiEncryptedApiKey,
                iv: row.geminiApiKeyIv,
              }
            : null,
        preferredModel: row.preferredGeminiModel || DEFAULT_MODELS.gemini,
      },
      preferredProvider: (row.preferredProvider as AIProvider) || "anthropic",
    };

    return {
      id: row.id,
      githubId: row.githubId,
      username: row.username,
      email: row.email || undefined,
      avatarUrl: row.avatarUrl || undefined,
      providerConfiguration,
      onboardingCompleted: row.onboardingCompleted || false,
      locale: row.locale || "en",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map domain state to database row (IAM columns only)
   */
  private mapStateToRow(state: UserState): Record<string, unknown> {
    return {
      id: state.id,
      githubId: state.githubId,
      username: state.username,
      email: state.email || null,
      avatarUrl: state.avatarUrl || null,
      // Anthropic
      encryptedApiKey:
        state.providerConfiguration.anthropic.apiKey?.encryptedValue || null,
      apiKeyIv: state.providerConfiguration.anthropic.apiKey?.iv || null,
      preferredAnthropicModel:
        state.providerConfiguration.anthropic.preferredModel,
      // OpenAI
      openaiEncryptedApiKey:
        state.providerConfiguration.openai.apiKey?.encryptedValue || null,
      openaiApiKeyIv: state.providerConfiguration.openai.apiKey?.iv || null,
      preferredOpenaiModel: state.providerConfiguration.openai.preferredModel,
      // Gemini
      geminiEncryptedApiKey:
        state.providerConfiguration.gemini.apiKey?.encryptedValue || null,
      geminiApiKeyIv: state.providerConfiguration.gemini.apiKey?.iv || null,
      preferredGeminiModel: state.providerConfiguration.gemini.preferredModel,
      // Preferences
      preferredProvider: state.providerConfiguration.preferredProvider,
      locale: state.locale,
      onboardingCompleted: state.onboardingCompleted,
      updatedAt: state.updatedAt,
    };
  }
}
