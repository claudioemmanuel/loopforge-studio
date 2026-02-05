/**
 * User Aggregate (IAM Domain)
 *
 * Represents a user account with AI provider configurations and preferences.
 * Handles invariant enforcement for user identity and provider settings.
 */

import type { Redis } from "ioredis";

export interface UserState {
  id: string;
  email: string | null; // ✅ Fixed: schema allows null
  githubId: string; // ✅ Fixed: schema uses text, not number
  username: string; // ✅ Fixed: schema uses username, not name
  avatarUrl: string | null; // ✅ Fixed: schema uses avatarUrl, not image
  locale: string; // ✅ Added: missing from original interface
  encryptedGithubToken: string | null; // ✅ Fixed: schema allows null
  githubTokenIv: string | null; // ✅ Fixed: schema allows null

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

  // User preferences (workflow settings)
  defaultCloneDirectory: string | null; // ✅ Fixed: schema uses defaultCloneDirectory
  defaultTestCommand: string | null; // ✅ Fixed: schema uses defaultTestCommand
  defaultTestTimeout: number | null; // ✅ Added: missing field from schema
  defaultTestGatePolicy: "strict" | "warn" | "skip" | "autoApprove" | null; // ✅ Fixed: schema uses defaultTestGatePolicy

  // Subscription
  subscriptionTier: "free" | "pro" | "enterprise";
  billingMode: "byok" | "managed"; // ✅ Added: missing field from schema
  subscriptionStatus: "active" | "canceled" | "past_due"; // ✅ Added: missing field from schema
  subscriptionPeriodEnd: Date | null; // ✅ Added: missing field from schema
  stripeCustomerId: string | null;

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
      email: string | null;
      githubId: string; // ✅ Fixed: text type
      username: string; // ✅ Fixed: username field
      avatarUrl: string | null; // ✅ Fixed: avatarUrl field
      locale: string; // ✅ Added: locale field
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
      defaultCloneDirectory: null, // ✅ Fixed: correct field name
      defaultTestCommand: null, // ✅ Fixed: correct field name
      defaultTestTimeout: null, // ✅ Added: missing field
      defaultTestGatePolicy: null, // ✅ Fixed: correct field name
      subscriptionTier: "enterprise",
      billingMode: "byok", // ✅ Added: missing field
      subscriptionStatus: "active", // ✅ Added: missing field
      subscriptionPeriodEnd: null, // ✅ Added: missing field
      stripeCustomerId: null,
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
    defaultCloneDirectory?: string;
    defaultTestCommand?: string;
    defaultTestTimeout?: number;
    defaultTestGatePolicy?: "strict" | "warn" | "skip" | "autoApprove";
  }): void {
    if (preferences.defaultCloneDirectory !== undefined) {
      this.state.defaultCloneDirectory = preferences.defaultCloneDirectory;
    }
    if (preferences.defaultTestCommand !== undefined) {
      this.state.defaultTestCommand = preferences.defaultTestCommand;
    }
    if (preferences.defaultTestTimeout !== undefined) {
      this.state.defaultTestTimeout = preferences.defaultTestTimeout;
    }
    if (preferences.defaultTestGatePolicy !== undefined) {
      this.state.defaultTestGatePolicy = preferences.defaultTestGatePolicy;
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
    billingMode?: "byok" | "managed";
    status?: "active" | "canceled" | "past_due";
    periodEnd?: Date;
    stripeCustomerId?: string;
  }): void {
    if (params.tier !== undefined) {
      this.state.subscriptionTier = params.tier;
    }
    if (params.billingMode !== undefined) {
      this.state.billingMode = params.billingMode;
    }
    if (params.status !== undefined) {
      this.state.subscriptionStatus = params.status;
    }
    if (params.periodEnd !== undefined) {
      this.state.subscriptionPeriodEnd = params.periodEnd;
    }
    if (params.stripeCustomerId !== undefined) {
      this.state.stripeCustomerId = params.stripeCustomerId;
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
