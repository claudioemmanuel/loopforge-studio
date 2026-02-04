/**
 * User Subscription Aggregate Root
 *
 * Manages user subscriptions, plan changes, and limit enforcement.
 * This is the main aggregate for the Billing bounded context.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type {
  PlanTier,
  BillingMode,
  SubscriptionStatus,
  PlanLimits,
} from "./types";
import { getPlanConfig, isLimitExceeded } from "./types";
import type {
  SubscriptionCreatedEvent,
  SubscriptionUpgradedEvent,
  SubscriptionDowngradedEvent,
  SubscriptionCanceledEvent,
  LimitExceededEvent,
} from "./events";

/**
 * Subscription aggregate state
 */
export interface SubscriptionState {
  id: string;
  userId: string;
  planTier: PlanTier;
  billingMode: BillingMode;
  status: SubscriptionStatus;
  limits: PlanLimits;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Subscription aggregate root
 *
 * Enforces invariants:
 * - Valid plan tier
 * - Active subscription has valid period
 * - Limits match plan tier
 */
export class UserSubscriptionAggregate {
  private state: SubscriptionState;
  private eventPublisher: EventPublisher;

  constructor(state: SubscriptionState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get subscription ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): SubscriptionState {
    return { ...this.state };
  }

  /**
   * Create a new subscription
   */
  static async create(
    params: {
      id: string;
      userId: string;
      planTier?: PlanTier;
      billingMode?: BillingMode;
    },
    redis: Redis,
  ): Promise<UserSubscriptionAggregate> {
    const planTier = params.planTier || "free";
    const billingMode = params.billingMode || "byok";
    const config = getPlanConfig(planTier);

    // Create initial state
    const state: SubscriptionState = {
      id: params.id,
      userId: params.userId,
      planTier,
      billingMode,
      status: "active",
      limits: config.limits,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      periodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const subscription = new UserSubscriptionAggregate(state, redis);

    // Publish SubscriptionCreated event
    const event: SubscriptionCreatedEvent = {
      id: crypto.randomUUID(),
      eventType: "SubscriptionCreated",
      aggregateType: "Subscription",
      aggregateId: state.id,
      occurredAt: new Date(),
      data: {
        subscriptionId: state.id,
        userId: state.userId,
        planTier,
        billingMode,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await subscription.eventPublisher.publish(event);

    return subscription;
  }

  /**
   * Upgrade subscription
   */
  async upgrade(newTier: PlanTier): Promise<void> {
    const oldTier = this.state.planTier;

    // Validate upgrade (can't downgrade with this method)
    if (this.getTierRank(newTier) <= this.getTierRank(oldTier)) {
      throw new Error(
        `Cannot upgrade from ${oldTier} to ${newTier}. Use downgrade() instead.`,
      );
    }

    // Update plan tier and limits
    const config = getPlanConfig(newTier);
    this.state.planTier = newTier;
    this.state.limits = config.limits;
    this.state.updatedAt = new Date();

    // Publish SubscriptionUpgraded event
    const event: SubscriptionUpgradedEvent = {
      id: crypto.randomUUID(),
      eventType: "SubscriptionUpgraded",
      aggregateType: "Subscription",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        subscriptionId: this.state.id,
        userId: this.state.userId,
        fromTier: oldTier,
        toTier: newTier,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Downgrade subscription
   */
  async downgrade(newTier: PlanTier): Promise<void> {
    const oldTier = this.state.planTier;

    // Validate downgrade
    if (this.getTierRank(newTier) >= this.getTierRank(oldTier)) {
      throw new Error(
        `Cannot downgrade from ${oldTier} to ${newTier}. Use upgrade() instead.`,
      );
    }

    // Update plan tier and limits
    const config = getPlanConfig(newTier);
    this.state.planTier = newTier;
    this.state.limits = config.limits;
    this.state.updatedAt = new Date();

    // Publish SubscriptionDowngraded event
    const event: SubscriptionDowngradedEvent = {
      id: crypto.randomUUID(),
      eventType: "SubscriptionDowngraded",
      aggregateType: "Subscription",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        subscriptionId: this.state.id,
        userId: this.state.userId,
        fromTier: oldTier,
        toTier: newTier,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Cancel subscription
   */
  async cancel(reason?: string): Promise<void> {
    this.state.status = "canceled";
    this.state.updatedAt = new Date();

    // Publish SubscriptionCanceled event
    const event: SubscriptionCanceledEvent = {
      id: crypto.randomUUID(),
      eventType: "SubscriptionCanceled",
      aggregateType: "Subscription",
      aggregateId: this.state.id,
      occurredAt: new Date(),
      data: {
        subscriptionId: this.state.id,
        userId: this.state.userId,
        reason,
        canceledAt: new Date(),
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Check if limit exceeded
   */
  async checkLimit(
    limitType: "maxRepos" | "maxTasks" | "maxTokensPerMonth",
    currentValue: number,
  ): Promise<boolean> {
    const limitValue = this.state.limits[limitType];
    const exceeded = isLimitExceeded(currentValue, limitValue);

    if (exceeded) {
      // Publish LimitExceeded event
      const event: LimitExceededEvent = {
        id: crypto.randomUUID(),
        eventType: "LimitExceeded",
        aggregateType: "Subscription",
        aggregateId: this.state.id,
        occurredAt: new Date(),
        data: {
          subscriptionId: this.state.id,
          userId: this.state.userId,
          limitType,
          currentValue,
          limitValue,
        },
        metadata: {
          correlationId: crypto.randomUUID(),
        },
      };

      await this.eventPublisher.publish(event);
    }

    return exceeded;
  }

  /**
   * Update Stripe information
   */
  updateStripeInfo(params: {
    customerId?: string;
    subscriptionId?: string;
  }): void {
    if (params.customerId) {
      this.state.stripeCustomerId = params.customerId;
    }
    if (params.subscriptionId) {
      this.state.stripeSubscriptionId = params.subscriptionId;
    }
    this.state.updatedAt = new Date();
  }

  /**
   * Update subscription status
   */
  updateStatus(status: SubscriptionStatus): void {
    this.state.status = status;
    this.state.updatedAt = new Date();
  }

  /**
   * Update period end
   */
  updatePeriodEnd(periodEnd: Date): void {
    this.state.periodEnd = periodEnd;
    this.state.updatedAt = new Date();
  }

  /**
   * Get plan tier rank (for comparison)
   */
  private getTierRank(tier: PlanTier): number {
    const ranks: Record<PlanTier, number> = {
      free: 1,
      pro: 2,
      enterprise: 3,
    };
    return ranks[tier];
  }

  /**
   * Get plan tier
   */
  getPlanTier(): PlanTier {
    return this.state.planTier;
  }

  /**
   * Get limits
   */
  getLimits(): PlanLimits {
    return { ...this.state.limits };
  }

  /**
   * Check if subscription is active
   */
  isActive(): boolean {
    return this.state.status === "active";
  }

  /**
   * Check if BYOK mode
   */
  isByok(): boolean {
    return this.state.billingMode === "byok";
  }
}
