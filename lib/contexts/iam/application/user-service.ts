/**
 * User Service (Application Layer)
 *
 * Orchestrates user operations and coordinates between domain and infrastructure.
 * This is the public API for the IAM bounded context.
 */

import type { Redis } from "ioredis";
import { UserAggregate } from "../domain/user-aggregate";
import { UserRepository } from "../infrastructure/user-repository";
import type { AIProvider } from "../domain/provider-config";
import { encryptApiKey, decryptApiKey } from "../infrastructure/crypto";

/**
 * User service for coordinating IAM operations
 */
export class UserService {
  private repository: UserRepository;

  constructor(redis: Redis) {
    this.repository = new UserRepository(redis);
  }

  /**
   * Register a new user via GitHub OAuth
   */
  async registerUser(params: {
    id: string;
    githubId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    locale?: string;
  }): Promise<{ userId: string }> {
    // Check if user already exists
    const existing = await this.repository.findByGithubId(params.githubId);
    if (existing) {
      // User already exists, return existing ID
      return { userId: existing.getId() };
    }

    // Register new user (publishes UserRegistered event)
    const user = await UserAggregate.register(params, this.repository["redis"]);

    // Save to database
    await this.repository.save(user);

    return { userId: user.getId() };
  }

  /**
   * Configure provider API key
   */
  async configureProvider(
    userId: string,
    provider: AIProvider,
    apiKey: string,
    preferredModel?: string,
  ): Promise<void> {
    // Find user
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Encrypt API key
    const encrypted = encryptApiKey(apiKey);

    // Configure provider (publishes ProviderConfigured event)
    await user.configureProvider(
      provider,
      {
        encryptedValue: encrypted.encrypted,
        iv: encrypted.iv,
      },
      preferredModel,
    );

    // Save to database
    await this.repository.save(user);
  }

  /**
   * Remove provider API key
   */
  async removeProvider(userId: string, provider: AIProvider): Promise<void> {
    // Find user
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Remove provider (publishes ProviderRemoved event)
    await user.removeProvider(provider);

    // Save to database
    await this.repository.save(user);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: {
      preferredProvider?: AIProvider;
      preferredAnthropicModel?: string;
      preferredOpenaiModel?: string;
      preferredGeminiModel?: string;
      locale?: string;
    },
  ): Promise<void> {
    // Find user
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Update preferences (publishes UserPreferencesUpdated event)
    await user.updatePreferences(preferences);

    // Save to database
    await this.repository.save(user);
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(userId: string): Promise<void> {
    // Find user
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Complete onboarding (publishes OnboardingCompleted event)
    await user.completeOnboarding();

    // Save to database
    await this.repository.save(user);
  }

  /**
   * Get user provider configuration for AI client
   */
  async getUserProviderConfig(userId: string): Promise<{
    provider: AIProvider;
    model: string;
    apiKey: string;
  } | null> {
    // Find user
    const user = await this.repository.findById(userId);
    if (!user) {
      return null;
    }

    // Get provider configuration
    const config = user.getProviderConfiguration();
    const activeProvider = config[config.preferredProvider];

    // Check if provider has API key
    if (!activeProvider.apiKey) {
      return null;
    }

    // Decrypt API key
    const apiKey = decryptApiKey({
      encrypted: activeProvider.apiKey.encryptedValue,
      iv: activeProvider.apiKey.iv,
    });

    return {
      provider: config.preferredProvider,
      model: activeProvider.preferredModel,
      apiKey,
    };
  }

  /**
   * Get API key for specific provider
   */
  async getProviderApiKey(
    userId: string,
    provider: AIProvider,
  ): Promise<string | null> {
    // Find user
    const user = await this.repository.findById(userId);
    if (!user) {
      return null;
    }

    // Get provider configuration
    const config = user.getProviderConfiguration();
    const providerConfig = config[provider];

    // Check if provider has API key
    if (!providerConfig.apiKey) {
      return null;
    }

    // Decrypt API key
    return decryptApiKey({
      encrypted: providerConfig.apiKey.encryptedValue,
      iv: providerConfig.apiKey.iv,
    });
  }

  /**
   * Check if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    const user = await this.repository.findById(userId);
    return user !== null;
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const user = await this.repository.findById(userId);
    if (!user) {
      return false;
    }
    return user.isOnboardingComplete();
  }
}
