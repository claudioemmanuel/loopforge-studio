/**
 * Billing Domain Events
 *
 * Events published by the Billing bounded context.
 */

import type { DomainEvent } from "@/lib/contexts/domain-events";

/**
 * Subscription created
 */
export interface SubscriptionCreatedEvent extends DomainEvent {
  eventType: "SubscriptionCreated";
  aggregateType: "Subscription";
  data: {
    subscriptionId: string;
    userId: string;
    planTier: string; // free | pro | enterprise
    billingMode: string; // byok | managed
  };
}

/**
 * Subscription upgraded
 */
export interface SubscriptionUpgradedEvent extends DomainEvent {
  eventType: "SubscriptionUpgraded";
  aggregateType: "Subscription";
  data: {
    subscriptionId: string;
    userId: string;
    fromTier: string;
    toTier: string;
  };
}

/**
 * Subscription downgraded
 */
export interface SubscriptionDowngradedEvent extends DomainEvent {
  eventType: "SubscriptionDowngraded";
  aggregateType: "Subscription";
  data: {
    subscriptionId: string;
    userId: string;
    fromTier: string;
    toTier: string;
  };
}

/**
 * Subscription canceled
 */
export interface SubscriptionCanceledEvent extends DomainEvent {
  eventType: "SubscriptionCanceled";
  aggregateType: "Subscription";
  data: {
    subscriptionId: string;
    userId: string;
    reason?: string;
    canceledAt: Date;
  };
}

/**
 * Usage recorded
 */
export interface UsageRecordedEvent extends DomainEvent {
  eventType: "UsageRecorded";
  aggregateType: "Usage";
  data: {
    usageId: string;
    userId: string;
    executionId: string;
    tokensUsed: number;
    provider: string; // anthropic | openai | gemini
    model: string;
    recordedAt: Date;
  };
}

/**
 * Limit exceeded
 */
export interface LimitExceededEvent extends DomainEvent {
  eventType: "LimitExceeded";
  aggregateType: "Subscription";
  data: {
    subscriptionId: string;
    userId: string;
    limitType: string; // max_repos | max_tasks | max_tokens
    currentValue: number;
    limitValue: number;
  };
}

/**
 * Billing period ended
 */
export interface BillingPeriodEndedEvent extends DomainEvent {
  eventType: "BillingPeriodEnded";
  aggregateType: "Subscription";
  data: {
    subscriptionId: string;
    userId: string;
    periodStart: Date;
    periodEnd: Date;
    totalTokensUsed: number;
  };
}

/**
 * Union type of all Billing events
 */
export type BillingEvent =
  | SubscriptionCreatedEvent
  | SubscriptionUpgradedEvent
  | SubscriptionDowngradedEvent
  | SubscriptionCanceledEvent
  | UsageRecordedEvent
  | LimitExceededEvent
  | BillingPeriodEndedEvent;
