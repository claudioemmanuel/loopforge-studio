/**
 * Subscription Repository (Infrastructure Layer)
 *
 * Manages persistence of subscription aggregates.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  UserSubscriptionAggregate,
  type SubscriptionState,
} from "../domain/subscription-aggregate";

/**
 * Subscription repository
 */
export class SubscriptionRepository {
  constructor(private redis: Redis) {}

  /**
   * Find subscription by ID
   */
  async findById(id: string): Promise<UserSubscriptionAggregate | null> {
    const [user] = await db
      .select({
        id: users.id,
        userId: users.id,
        subscriptionTier: users.subscriptionTier,
        billingMode: users.billingMode,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        subscriptionPeriodEnd: users.subscriptionPeriodEnd,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!user) {
      return null;
    }

    // Map database columns to domain model
    const planTier = (user.subscriptionTier || "free") as
      | "free"
      | "pro"
      | "enterprise";
    const billingMode = (user.billingMode || "byok") as "byok" | "managed";
    const status = (user.subscriptionStatus || "active") as
      | "active"
      | "past_due"
      | "canceled"
      | "trialing";

    // Calculate limits from plan config (don't store in DB)
    const { getPlanConfig } = await import("../domain/types");
    const config = getPlanConfig(planTier);

    const state: SubscriptionState = {
      id: user.id,
      userId: user.userId,
      planTier,
      billingMode,
      status,
      limits: config.limits,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: null, // Not stored in current schema
      periodEnd: user.subscriptionPeriodEnd,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return new UserSubscriptionAggregate(state, this.redis);
  }

  /**
   * Find subscription by user ID
   */
  async findByUserId(
    userId: string,
  ): Promise<UserSubscriptionAggregate | null> {
    return this.findById(userId);
  }

  /**
   * Save subscription
   */
  async save(subscription: UserSubscriptionAggregate): Promise<void> {
    const state = subscription.getState();

    // Map domain model to database columns
    await db
      .update(users)
      .set({
        subscriptionTier: state.planTier, // Map planTier -> subscriptionTier
        billingMode: state.billingMode,
        subscriptionStatus: state.status,
        stripeCustomerId: state.stripeCustomerId,
        subscriptionPeriodEnd: state.periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(users.id, state.id));

    // Note: limits are NOT stored in DB, they're calculated from tier
  }

  /**
   * Find all subscriptions (for admin/analytics)
   */
  async findAll(): Promise<UserSubscriptionAggregate[]> {
    const allUsers = await db
      .select({
        id: users.id,
        userId: users.id,
        subscriptionTier: users.subscriptionTier,
        billingMode: users.billingMode,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        subscriptionPeriodEnd: users.subscriptionPeriodEnd,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users);

    const { getPlanConfig } = await import("../domain/types");

    return allUsers.map((user) => {
      const planTier = (user.subscriptionTier || "free") as
        | "free"
        | "pro"
        | "enterprise";
      const billingMode = (user.billingMode || "byok") as "byok" | "managed";
      const status = (user.subscriptionStatus || "active") as
        | "active"
        | "past_due"
        | "canceled"
        | "trialing";

      const config = getPlanConfig(planTier);

      const state: SubscriptionState = {
        id: user.id,
        userId: user.userId,
        planTier,
        billingMode,
        status,
        limits: config.limits,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: null,
        periodEnd: user.subscriptionPeriodEnd,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      return new UserSubscriptionAggregate(state, this.redis);
    });
  }
}
