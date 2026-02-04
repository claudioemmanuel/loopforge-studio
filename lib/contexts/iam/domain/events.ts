/**
 * IAM Domain Events
 *
 * Events published by the Identity & Access Management bounded context.
 */

import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * User registered via GitHub OAuth
 */
export interface UserRegisteredEvent extends DomainEvent {
  eventType: "UserRegistered";
  aggregateType: "User";
  data: {
    userId: string;
    githubId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
  };
}

/**
 * AI Provider configured (API key added/updated)
 */
export interface ProviderConfiguredEvent extends DomainEvent {
  eventType: "ProviderConfigured";
  aggregateType: "User";
  data: {
    userId: string;
    provider: "anthropic" | "openai" | "gemini";
    hasApiKey: boolean; // Don't include actual key in event
  };
}

/**
 * AI Provider removed (API key deleted)
 */
export interface ProviderRemovedEvent extends DomainEvent {
  eventType: "ProviderRemoved";
  aggregateType: "User";
  data: {
    userId: string;
    provider: "anthropic" | "openai" | "gemini";
  };
}

/**
 * User preferences updated (preferred provider/model)
 */
export interface UserPreferencesUpdatedEvent extends DomainEvent {
  eventType: "UserPreferencesUpdated";
  aggregateType: "User";
  data: {
    userId: string;
    preferredProvider?: "anthropic" | "openai" | "gemini";
    preferredAnthropicModel?: string;
    preferredOpenaiModel?: string;
    preferredGeminiModel?: string;
    locale?: string;
  };
}

/**
 * User session expired
 */
export interface SessionExpiredEvent extends DomainEvent {
  eventType: "SessionExpired";
  aggregateType: "User";
  data: {
    userId: string;
    sessionId: string;
  };
}

/**
 * Onboarding completed
 */
export interface OnboardingCompletedEvent extends DomainEvent {
  eventType: "OnboardingCompleted";
  aggregateType: "User";
  data: {
    userId: string;
  };
}

/**
 * Union type of all IAM events
 */
export type IAMDomainEvent =
  | UserRegisteredEvent
  | ProviderConfiguredEvent
  | ProviderRemovedEvent
  | UserPreferencesUpdatedEvent
  | SessionExpiredEvent
  | OnboardingCompletedEvent;
