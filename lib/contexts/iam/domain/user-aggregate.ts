/**
 * User Aggregate (IAM Domain)
 *
 * Represents a user account with AI provider configurations and preferences.
 * Handles invariant enforcement for user identity and provider settings.
 */

import type { Redis } from "ioredis";

export interface UserState {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  githubId: number;
  githubUsername: string | null;
  encryptedGithubToken: string;
  githubTokenIv: string;

  // Provider configurations
  preferredProvider: "anthropic" | "openai" | "gemini" | null;

  // Anthropic
  encryptedApiKey: string | null;
  apiKeyIv: string | null;
  preferredAnthropicModel: string | null;

  // OpenAI
  openaiEncryptedApiKey: string | null;
  openaiApiKeyIv: string | null;
  preferredOpenaiModel: string | null;

  // Gemini
  geminiEncryptedApiKey: string | null;
  geminiApiKeyIv: string | null;
  preferredGeminiModel: string | null;

  // User preferences
  cloneDirectory: string | null;
  testRunCommand: string | null;
  testGatePolicy: "strict" | "warn" | "skip" | "autoApprove" | null;

  // Subscription
  subscriptionTier: "free" | "pro" | "enterprise";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;

  // Onboarding
  onboardingCompleted: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export class UserAggregate {
  private state: UserState;
  private redis: Redis;

  constructor(state: UserState, redis: Redis) {
    this.state = state;
    this.redis = redis;
  }

  /**
   * Create a new user
   */
  static async create(
    params: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      githubId: number;
      githubUsername: string | null;
      encryptedGithubToken: string;
      githubTokenIv: string;
    },
    redis: Redis,
  ): Promise<UserAggregate> {
    const state: UserState = {
      ...params,
      preferredProvider: null,
      encryptedApiKey: null,
      apiKeyIv: null,
      preferredAnthropicModel: null,
      openaiEncryptedApiKey: null,
      openaiApiKeyIv: null,
      preferredOpenaiModel: null,
      geminiEncryptedApiKey: null,
      geminiApiKeyIv: null,
      preferredGeminiModel: null,
      cloneDirectory: null,
      testRunCommand: null,
      testGatePolicy: null,
      subscriptionTier: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new UserAggregate(state, redis);
  }

  /**
   * Configure AI provider
   */
  configureProvider(
    provider: "anthropic" | "openai" | "gemini",
    encryptedApiKey: string,
    apiKeyIv: string,
    preferredModel?: string | null,
  ): void {
    this.state.preferredProvider = provider;

    if (provider === "anthropic") {
      this.state.encryptedApiKey = encryptedApiKey;
      this.state.apiKeyIv = apiKeyIv;
      if (preferredModel !== undefined) {
        this.state.preferredAnthropicModel = preferredModel;
      }
    } else if (provider === "openai") {
      this.state.openaiEncryptedApiKey = encryptedApiKey;
      this.state.openaiApiKeyIv = apiKeyIv;
      if (preferredModel !== undefined) {
        this.state.preferredOpenaiModel = preferredModel;
      }
    } else if (provider === "gemini") {
      this.state.geminiEncryptedApiKey = encryptedApiKey;
      this.state.geminiApiKeyIv = apiKeyIv;
      if (preferredModel !== undefined) {
        this.state.preferredGeminiModel = preferredModel;
      }
    }

    this.state.updatedAt = new Date();
  }

  /**
   * Remove provider configuration
   */
  removeProvider(provider: "anthropic" | "openai" | "gemini"): void {
    if (provider === "anthropic") {
      this.state.encryptedApiKey = null;
      this.state.apiKeyIv = null;
      this.state.preferredAnthropicModel = null;
    } else if (provider === "openai") {
      this.state.openaiEncryptedApiKey = null;
      this.state.openaiApiKeyIv = null;
      this.state.preferredOpenaiModel = null;
    } else if (provider === "gemini") {
      this.state.geminiEncryptedApiKey = null;
      this.state.geminiApiKeyIv = null;
      this.state.preferredGeminiModel = null;
    }

    // If removing the preferred provider, clear it
    if (this.state.preferredProvider === provider) {
      this.state.preferredProvider = null;
    }

    this.state.updatedAt = new Date();
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: {
    cloneDirectory?: string;
    testRunCommand?: string;
    testGatePolicy?: "strict" | "warn" | "skip" | "autoApprove";
  }): void {
    if (preferences.cloneDirectory !== undefined) {
      this.state.cloneDirectory = preferences.cloneDirectory;
    }
    if (preferences.testRunCommand !== undefined) {
      this.state.testRunCommand = preferences.testRunCommand;
    }
    if (preferences.testGatePolicy !== undefined) {
      this.state.testGatePolicy = preferences.testGatePolicy;
    }

    this.state.updatedAt = new Date();
  }

  /**
   * Complete onboarding
   */
  completeOnboarding(): void {
    this.state.onboardingCompleted = true;
    this.state.updatedAt = new Date();
  }

  /**
   * Update subscription info
   */
  updateSubscription(params: {
    tier?: "free" | "pro" | "enterprise";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }): void {
    if (params.tier !== undefined) {
      this.state.subscriptionTier = params.tier;
    }
    if (params.stripeCustomerId !== undefined) {
      this.state.stripeCustomerId = params.stripeCustomerId;
    }
    if (params.stripeSubscriptionId !== undefined) {
      this.state.stripeSubscriptionId = params.stripeSubscriptionId;
    }

    this.state.updatedAt = new Date();
  }

  /**
   * Get aggregate state
   */
  getState(): UserState {
    return { ...this.state };
  }

  /**
   * Get aggregate ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Check if provider is configured
   */
  hasProviderConfigured(provider: "anthropic" | "openai" | "gemini"): boolean {
    if (provider === "anthropic") {
      return !!(this.state.encryptedApiKey && this.state.apiKeyIv);
    } else if (provider === "openai") {
      return !!(this.state.openaiEncryptedApiKey && this.state.openaiApiKeyIv);
    } else if (provider === "gemini") {
      return !!(this.state.geminiEncryptedApiKey && this.state.geminiApiKeyIv);
    }
    return false;
  }

  /**
   * Check if onboarding is complete
   */
  hasCompletedOnboarding(): boolean {
    return this.state.onboardingCompleted;
  }
}
