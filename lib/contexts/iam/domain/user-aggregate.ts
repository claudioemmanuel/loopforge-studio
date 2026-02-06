/**
 * User Aggregate (IAM Domain)
 *
 * Represents a user account with AI provider configurations and preferences.
 * Handles invariant enforcement for user identity and provider settings.
 */

import { randomUUID } from "crypto";
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
  static create(
    params: {
      id: string;
      email: string | null;
      githubId: string;
      username: string;
      avatarUrl: string | null;
      locale: string;
      encryptedGithubToken: string;
      githubTokenIv: string;
    },
    redis: Redis,
  ): [UserAggregate, import("./events").UserRegisteredEvent] {
    const now = new Date();
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
      defaultCloneDirectory: null,
      defaultTestCommand: null,
      defaultTestTimeout: null,
      defaultTestGatePolicy: null,
      subscriptionTier: "enterprise",
      billingMode: "byok",
      subscriptionStatus: "active",
      subscriptionPeriodEnd: null,
      stripeCustomerId: null,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const event: import("./events").UserRegisteredEvent = {
      id: randomUUID(),
      eventType: "UserRegistered",
      aggregateType: "User",
      aggregateId: params.id,
      occurredAt: now,
      data: {
        userId: params.id,
        githubId: params.githubId,
        username: params.username,
        email: params.email ?? undefined,
        avatarUrl: params.avatarUrl ?? undefined,
      },
    };

    return [new UserAggregate(state, redis), event];
  }

  /**
   * Configure AI provider
   */
  configureProvider(
    provider: "anthropic" | "openai" | "gemini",
    encryptedApiKey: string,
    apiKeyIv: string,
    preferredModel?: string | null,
  ): [UserAggregate, import("./events").ProviderConfiguredEvent] {
    const now = new Date();
    const newState = { ...this.state };
    newState.preferredProvider = provider;

    if (provider === "anthropic") {
      newState.encryptedApiKey = encryptedApiKey;
      newState.apiKeyIv = apiKeyIv;
      if (preferredModel !== undefined) {
        newState.preferredAnthropicModel = preferredModel;
      }
    } else if (provider === "openai") {
      newState.openaiEncryptedApiKey = encryptedApiKey;
      newState.openaiApiKeyIv = apiKeyIv;
      if (preferredModel !== undefined) {
        newState.preferredOpenaiModel = preferredModel;
      }
    } else if (provider === "gemini") {
      newState.geminiEncryptedApiKey = encryptedApiKey;
      newState.geminiApiKeyIv = apiKeyIv;
      if (preferredModel !== undefined) {
        newState.preferredGeminiModel = preferredModel;
      }
    }

    newState.updatedAt = now;

    const event: import("./events").ProviderConfiguredEvent = {
      id: randomUUID(),
      eventType: "ProviderConfigured",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        userId: this.state.id,
        provider,
        hasApiKey: true,
      },
    };

    return [new UserAggregate(newState, this.redis), event];
  }

  /**
   * Remove provider configuration
   */
  removeProvider(
    provider: "anthropic" | "openai" | "gemini",
  ): [UserAggregate, import("./events").ProviderRemovedEvent] {
    const now = new Date();
    const newState = { ...this.state };

    if (provider === "anthropic") {
      newState.encryptedApiKey = null;
      newState.apiKeyIv = null;
      newState.preferredAnthropicModel = null;
    } else if (provider === "openai") {
      newState.openaiEncryptedApiKey = null;
      newState.openaiApiKeyIv = null;
      newState.preferredOpenaiModel = null;
    } else if (provider === "gemini") {
      newState.geminiEncryptedApiKey = null;
      newState.geminiApiKeyIv = null;
      newState.preferredGeminiModel = null;
    }

    // If removing the preferred provider, clear it
    if (newState.preferredProvider === provider) {
      newState.preferredProvider = null;
    }

    newState.updatedAt = now;

    const event: import("./events").ProviderRemovedEvent = {
      id: randomUUID(),
      eventType: "ProviderRemoved",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        userId: this.state.id,
        provider,
      },
    };

    return [new UserAggregate(newState, this.redis), event];
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: {
    defaultCloneDirectory?: string;
    defaultTestCommand?: string;
    defaultTestTimeout?: number;
    defaultTestGatePolicy?: "strict" | "warn" | "skip" | "autoApprove";
  }): [UserAggregate, import("./events").UserPreferencesUpdatedEvent] {
    const now = new Date();
    const newState = { ...this.state };

    if (preferences.defaultCloneDirectory !== undefined) {
      newState.defaultCloneDirectory = preferences.defaultCloneDirectory;
    }
    if (preferences.defaultTestCommand !== undefined) {
      newState.defaultTestCommand = preferences.defaultTestCommand;
    }
    if (preferences.defaultTestTimeout !== undefined) {
      newState.defaultTestTimeout = preferences.defaultTestTimeout;
    }
    if (preferences.defaultTestGatePolicy !== undefined) {
      newState.defaultTestGatePolicy = preferences.defaultTestGatePolicy;
    }

    newState.updatedAt = now;

    const event: import("./events").UserPreferencesUpdatedEvent = {
      id: randomUUID(),
      eventType: "UserPreferencesUpdated",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        userId: this.state.id,
      },
    };

    return [new UserAggregate(newState, this.redis), event];
  }

  /**
   * Complete onboarding
   */
  completeOnboarding(): [
    UserAggregate,
    import("./events").OnboardingCompletedEvent,
  ] {
    const now = new Date();
    const newState = { ...this.state };
    newState.onboardingCompleted = true;
    newState.updatedAt = now;

    const event: import("./events").OnboardingCompletedEvent = {
      id: randomUUID(),
      eventType: "OnboardingCompleted",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: now,
      data: {
        userId: this.state.id,
      },
    };

    return [new UserAggregate(newState, this.redis), event];
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
