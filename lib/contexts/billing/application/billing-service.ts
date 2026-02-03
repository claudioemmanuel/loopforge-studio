/**
 * Billing Service (Application Layer)
 *
 * Orchestrates subscription and usage operations.
 * Wraps the existing lib/billing/domain helpers behind a single service.
 */

import type { Redis } from "ioredis";
import {
  checkRepoLimit,
  checkTaskLimit,
  type LimitCheckResult,
} from "@/lib/billing/domain/limits";
import {
  recordUsage,
  getUsageSummary,
  type UsageSummary,
} from "@/lib/billing/domain/usage";
import {
  createCheckoutSession,
  createPortalSession,
  type CreateCheckoutParams,
} from "@/lib/billing/infra/stripe";

export class BillingService {
  // Redis kept for future event publishing; unused today.
  private _redis: Redis;

  constructor(redis: Redis) {
    this._redis = redis;
  }

  // =========================================================================
  // Limit checks
  // =========================================================================

  /** Can the user add another repository? */
  async checkRepoLimit(userId: string): Promise<LimitCheckResult> {
    return checkRepoLimit(userId);
  }

  /** Can the user add another task in the given repo? */
  async checkTaskLimit(
    userId: string,
    repoId: string,
  ): Promise<LimitCheckResult> {
    return checkTaskLimit(userId, repoId);
  }

  // =========================================================================
  // Usage tracking
  // =========================================================================

  /** Record token usage for a completed AI call. */
  async recordUsage(params: {
    userId: string;
    taskId?: string;
    executionId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    return recordUsage(params);
  }

  /** Get the current-period usage summary for a user. */
  async getUsageSummary(userId: string): Promise<UsageSummary> {
    return getUsageSummary(userId);
  }

  // =========================================================================
  // Stripe sessions
  // =========================================================================

  /** Create a Stripe Checkout session. */
  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<{ url: string } | { error: string }> {
    return createCheckoutSession(params);
  }

  /** Create a Stripe Billing Portal session. */
  async createPortalSession(params: {
    userId: string;
  }): Promise<{ url: string } | { error: string }> {
    return createPortalSession(params.userId);
  }
}
