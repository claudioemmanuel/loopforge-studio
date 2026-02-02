/**
 * User Aggregate Root
 *
 * Manages user identity, authentication, and provider API key configuration.
 * This is the aggregate root for the IAM bounded context.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type {
  AIProvider,
  EncryptedApiKey,
  UserProviderConfiguration,
} from "./provider-config";
import {
  hasAtLeastOneProvider,
  hasValidApiKey,
  DEFAULT_MODELS,
} from "./provider-config";
import type {
  UserRegisteredEvent,
  ProviderConfiguredEvent,
  ProviderRemovedEvent,
  UserPreferencesUpdatedEvent,
  OnboardingCompletedEvent,
} from "./events";

/**
 * User aggregate state
 */
export interface UserState {
  id: string;
  githubId: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  providerConfiguration: UserProviderConfiguration;
  onboardingCompleted: boolean;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User aggregate root
 *
 * Enforces invariants:
 * - Unique GitHub ID
 * - At least one configured provider (after onboarding)
 * - Valid encrypted API keys
 */
export class UserAggregate {
  private state: UserState;
  private eventPublisher: EventPublisher;

  constructor(state: UserState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get user ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): UserState {
    return { ...this.state };
  }

  /**
   * Register a new user via GitHub OAuth
   */
  static async register(
    params: {
      id: string;
      githubId: string;
      username: string;
      email?: string;
      avatarUrl?: string;
      locale?: string;
    },
    redis: Redis,
  ): Promise<UserAggregate> {
    // Create initial state
    const state: UserState = {
      id: params.id,
      githubId: params.githubId,
      username: params.username,
      email: params.email,
      avatarUrl: params.avatarUrl,
      providerConfiguration: {
        anthropic: {
          provider: "anthropic",
          apiKey: null,
          preferredModel: DEFAULT_MODELS.anthropic,
        },
        openai: {
          provider: "openai",
          apiKey: null,
          preferredModel: DEFAULT_MODELS.openai,
        },
        gemini: {
          provider: "gemini",
          apiKey: null,
          preferredModel: DEFAULT_MODELS.gemini,
        },
        preferredProvider: "anthropic",
      },
      onboardingCompleted: false,
      locale: params.locale || "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const user = new UserAggregate(state, redis);

    // Publish UserRegistered event
    const event: UserRegisteredEvent = {
      id: crypto.randomUUID(),
      eventType: "UserRegistered",
      aggregateType: "User",
      aggregateId: state.id,
      occurredAt: new Date(),
      data: {
        userId: state.id,
        githubId: state.githubId,
        username: state.username,
        email: state.email,
        avatarUrl: state.avatarUrl,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await user.eventPublisher.publish(event);

    return user;
  }

  /**
   * Configure a provider (add/update API key)
   */
  async configureProvider(
    provider: AIProvider,
    encryptedApiKey: EncryptedApiKey,
    preferredModel?: string,
  ): Promise<void> {
    // Update provider configuration
    this.state.providerConfiguration[provider] = {
      provider,
      apiKey: encryptedApiKey,
      preferredModel:
        preferredModel ||
        this.state.providerConfiguration[provider].preferredModel,
    };

    this.state.updatedAt = new Date();

    // Publish ProviderConfigured event
    const event: ProviderConfiguredEvent = {
      id: crypto.randomUUID(),
      eventType: "ProviderConfigured",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        userId: this.state.id,
        provider,
        hasApiKey: true,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Remove provider API key
   */
  async removeProvider(provider: AIProvider): Promise<void> {
    // Remove API key
    this.state.providerConfiguration[provider].apiKey = null;
    this.state.updatedAt = new Date();

    // If this was the preferred provider, switch to another one that has a key
    if (this.state.providerConfiguration.preferredProvider === provider) {
      // Find another provider with a valid key
      const otherProvider = (
        ["anthropic", "openai", "gemini"] as AIProvider[]
      ).find(
        (p) =>
          p !== provider && hasValidApiKey(this.state.providerConfiguration[p]),
      );

      if (otherProvider) {
        this.state.providerConfiguration.preferredProvider = otherProvider;
      }
    }

    // Publish ProviderRemoved event
    const event: ProviderRemovedEvent = {
      id: crypto.randomUUID(),
      eventType: "ProviderRemoved",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        userId: this.state.id,
        provider,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: {
    preferredProvider?: AIProvider;
    preferredAnthropicModel?: string;
    preferredOpenaiModel?: string;
    preferredGeminiModel?: string;
    locale?: string;
  }): Promise<void> {
    let changed = false;

    // Update preferred provider
    if (
      preferences.preferredProvider &&
      preferences.preferredProvider !==
        this.state.providerConfiguration.preferredProvider
    ) {
      // Ensure the new preferred provider has a valid API key
      if (
        !hasValidApiKey(
          this.state.providerConfiguration[preferences.preferredProvider],
        )
      ) {
        throw new Error(
          `Cannot set preferred provider to ${preferences.preferredProvider}: no API key configured`,
        );
      }

      this.state.providerConfiguration.preferredProvider =
        preferences.preferredProvider;
      changed = true;
    }

    // Update preferred models
    if (preferences.preferredAnthropicModel) {
      this.state.providerConfiguration.anthropic.preferredModel =
        preferences.preferredAnthropicModel;
      changed = true;
    }

    if (preferences.preferredOpenaiModel) {
      this.state.providerConfiguration.openai.preferredModel =
        preferences.preferredOpenaiModel;
      changed = true;
    }

    if (preferences.preferredGeminiModel) {
      this.state.providerConfiguration.gemini.preferredModel =
        preferences.preferredGeminiModel;
      changed = true;
    }

    // Update locale
    if (preferences.locale && preferences.locale !== this.state.locale) {
      this.state.locale = preferences.locale;
      changed = true;
    }

    if (changed) {
      this.state.updatedAt = new Date();

      // Publish UserPreferencesUpdated event
      const event: UserPreferencesUpdatedEvent = {
        id: crypto.randomUUID(),
        eventType: "UserPreferencesUpdated",
        aggregateType: "User",
        aggregateId: this.state.id,
        occurredAt: new Date(),
        data: {
          userId: this.state.id,
          ...preferences,
        },
        metadata: {
          correlationId: crypto.randomUUID(),
        },
      };

      await this.eventPublisher.publish(event);
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(): Promise<void> {
    // Invariant: User must have at least one provider configured
    if (!hasAtLeastOneProvider(this.state.providerConfiguration)) {
      throw new Error("Cannot complete onboarding: no provider configured");
    }

    this.state.onboardingCompleted = true;
    this.state.updatedAt = new Date();

    // Publish OnboardingCompleted event
    const event: OnboardingCompletedEvent = {
      id: crypto.randomUUID(),
      eventType: "OnboardingCompleted",
      aggregateType: "User",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        userId: this.state.id,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Check if user has completed onboarding
   */
  isOnboardingComplete(): boolean {
    return this.state.onboardingCompleted;
  }

  /**
   * Get provider configuration
   */
  getProviderConfiguration(): UserProviderConfiguration {
    return { ...this.state.providerConfiguration };
  }

  /**
   * Check if user has at least one provider configured
   */
  hasProviderConfigured(): boolean {
    return hasAtLeastOneProvider(this.state.providerConfiguration);
  }
}
