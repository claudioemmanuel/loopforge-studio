/**
 * User Service (Application Layer)
 *
 * Orchestrates user operations and coordinates with infrastructure.
 * Public API for IAM bounded context.
 */

import type { Redis } from "ioredis";
import { UserRepository } from "../infrastructure/user-repository";
import { UserAggregate } from "../domain/user-aggregate";
import { decryptApiKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";

export class UserService {
  private userRepository: UserRepository;

  constructor(redis: Redis) {
    this.userRepository = new UserRepository(redis);
  }

  /**
   * Register a new user
   */
  async registerUser(params: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    githubId: number;
    githubUsername: string | null;
    encryptedGithubToken: string;
    githubTokenIv: string;
  }): Promise<{ userId: string }> {
    const user = await UserAggregate.create(
      params,
      this.userRepository["redis"],
    );

    await this.userRepository.save(user);

    return { userId: user.getId() };
  }

  /**
   * Configure AI provider for user
   */
  async configureProvider(params: {
    userId: string;
    provider: "anthropic" | "openai" | "gemini";
    apiKey: string;
    preferredModel?: string | null;
  }): Promise<void> {
    const user = await this.userRepository.findById(params.userId);

    if (!user) {
      throw new Error(`User ${params.userId} not found`);
    }

    // Encrypt the API key
    const { encryptApiKey } = await import("@/lib/crypto");
    const { encrypted, iv } = encryptApiKey(params.apiKey);

    user.configureProvider(
      params.provider,
      encrypted,
      iv,
      params.preferredModel,
    );

    await this.userRepository.save(user);
  }

  /**
   * Remove provider configuration
   */
  async removeProvider(
    userId: string,
    provider: "anthropic" | "openai" | "gemini",
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    user.removeProvider(provider);

    await this.userRepository.save(user);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(params: {
    userId: string;
    preferences: {
      cloneDirectory?: string;
      testRunCommand?: string;
      testGatePolicy?: "strict" | "warn" | "skip" | "autoApprove";
    };
  }): Promise<void> {
    const user = await this.userRepository.findById(params.userId);

    if (!user) {
      throw new Error(`User ${params.userId} not found`);
    }

    user.updatePreferences(params.preferences);

    await this.userRepository.save(user);
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    user.completeOnboarding();

    await this.userRepository.save(user);
  }

  /**
   * Update subscription information
   */
  async updateSubscription(params: {
    userId: string;
    tier?: "free" | "pro" | "enterprise";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }): Promise<void> {
    const user = await this.userRepository.findById(params.userId);

    if (!user) {
      throw new Error(`User ${params.userId} not found`);
    }

    user.updateSubscription({
      tier: params.tier,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
    });

    await this.userRepository.save(user);
  }

  /**
   * Get user by ID
   */
  async getUserFull(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return null;
    }

    return user.getState();
  }

  /**
   * Get user provider configuration
   */
  async getUserProviderConfig(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const state = user.getState();

    return {
      preferredProvider: state.preferredProvider,
      anthropic: state.encryptedApiKey
        ? {
            configured: true,
            preferredModel: state.preferredAnthropicModel,
          }
        : null,
      openai: state.openaiEncryptedApiKey
        ? {
            configured: true,
            preferredModel: state.preferredOpenaiModel,
          }
        : null,
      gemini: state.geminiEncryptedApiKey
        ? {
            configured: true,
            preferredModel: state.preferredGeminiModel,
          }
        : null,
    };
  }

  /**
   * Get decrypted API key for a provider
   */
  async getProviderApiKey(
    userId: string,
    provider: "anthropic" | "openai" | "gemini",
  ): Promise<string | null> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return null;
    }

    const state = user.getState();

    let encryptedKey: string | null = null;
    let iv: string | null = null;

    if (provider === "anthropic") {
      encryptedKey = state.encryptedApiKey;
      iv = state.apiKeyIv;
    } else if (provider === "openai") {
      encryptedKey = state.openaiEncryptedApiKey;
      iv = state.openaiApiKeyIv;
    } else if (provider === "gemini") {
      encryptedKey = state.geminiEncryptedApiKey;
      iv = state.geminiApiKeyIv;
    }

    if (!encryptedKey || !iv) {
      return null;
    }

    return decryptApiKey(encryptedKey, iv);
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return false;
    }

    return user.hasCompletedOnboarding();
  }

  /**
   * Update user locale preference.
   * Direct DB write because the aggregate does not yet model locale.
   */
  async updateLocale(userId: string, locale: string): Promise<void> {
    await db.update(users).set({ locale }).where(eq(users.id, userId));
  }

  /**
   * Generic field update on the user row.
   * Caller is responsible for validation; mirrors TaskService.updateFields.
   */
  async updateUserFields(
    userId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(users)
      .set({ ...fields, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(users.id, userId));
  }

  /**
   * Delete user account
   */
  async deleteUser(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }
}
