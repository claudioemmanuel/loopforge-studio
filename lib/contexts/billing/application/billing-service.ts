/**
 * Billing Service (Application Layer)
 *
 * Orchestrates subscription operations and coordinates with infrastructure.
 * Public API for Billing bounded context.
 */

import type { Redis } from "ioredis";
import { SubscriptionRepository } from "../infrastructure/subscription-repository";
import { UserSubscriptionAggregate } from "../domain/subscription-aggregate";
import type { PlanTier, BillingMode, PlanLimits } from "../domain/types";

/**
 * Billing service
 */
export class BillingService {
  private subscriptionRepository: SubscriptionRepository;

  constructor(redis: Redis) {
    this.subscriptionRepository = new SubscriptionRepository(redis);
  }

  /**
   * Create a new subscription for user
   */
  async createSubscription(params: {
    userId: string;
    planTier?: PlanTier;
    billingMode?: BillingMode;
  }): Promise<{ subscriptionId: string }> {
    // Create subscription aggregate
    const subscription = await UserSubscriptionAggregate.create(
      {
        id: params.userId, // Subscription ID = User ID (1-to-1 relationship)
        userId: params.userId,
        planTier: params.planTier,
        billingMode: params.billingMode,
      },
      this.subscriptionRepository["redis"],
    );

    // Persist
    await this.subscriptionRepository.save(subscription);

    return { subscriptionId: subscription.getId() };
  }

  /**
   * Get subscription for user
   */
  async getSubscription(userId: string): Promise<{
    id: string;
    userId: string;
    planTier: PlanTier;
    billingMode: BillingMode;
    status: string;
    limits: PlanLimits;
    isActive: boolean;
    isByok: boolean;
  } | null> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      return null;
    }

    const state = subscription.getState();

    return {
      id: state.id,
      userId: state.userId,
      planTier: state.planTier,
      billingMode: state.billingMode,
      status: state.status,
      limits: state.limits,
      isActive: subscription.isActive(),
      isByok: subscription.isByok(),
    };
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(params: {
    userId: string;
    newTier: PlanTier;
  }): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    await subscription.upgrade(params.newTier);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Downgrade subscription
   */
  async downgradeSubscription(params: {
    userId: string;
    newTier: PlanTier;
  }): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    await subscription.downgrade(params.newTier);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(params: {
    userId: string;
    reason?: string;
  }): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    await subscription.cancel(params.reason);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Update Stripe information
   */
  async updateStripeInfo(params: {
    userId: string;
    customerId?: string;
    subscriptionId?: string;
  }): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    subscription.updateStripeInfo({
      customerId: params.customerId,
      subscriptionId: params.subscriptionId,
    });

    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Update subscription status
   */
  async updateStatus(params: {
    userId: string;
    status: "active" | "past_due" | "canceled" | "trialing";
  }): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    subscription.updateStatus(params.status);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Update period end
   */
  async updatePeriodEnd(params: {
    userId: string;
    periodEnd: Date;
  }): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    subscription.updatePeriodEnd(params.periodEnd);
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Check if limit exceeded
   */
  async checkLimit(params: {
    userId: string;
    limitType: "maxRepos" | "maxTasks" | "maxTokensPerMonth";
    currentValue: number;
  }): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findByUserId(
      params.userId,
    );

    if (!subscription) {
      throw new Error(`Subscription for user ${params.userId} not found`);
    }

    const exceeded = await subscription.checkLimit(
      params.limitType,
      params.currentValue,
    );

    // Save to persist any events
    await this.subscriptionRepository.save(subscription);

    return exceeded;
  }
}
