/**
 * Billing API Adapters
 *
 * Maps between Billing domain models and API response/request formats.
 * Preserves backward compatibility with existing API contracts.
 */

import type { SubscriptionState } from "../domain/subscription-aggregate";
import type {
  PlanTier,
  BillingMode,
  SubscriptionStatus,
  PlanLimits,
  UsageSummary,
} from "../domain/types";

/**
 * API response format for subscription
 * Matches existing database schema and frontend expectations
 */
export interface SubscriptionApiResponse {
  id: string;
  userId: string;

  // Plan information
  planTier: PlanTier;
  billingMode: BillingMode;
  status: SubscriptionStatus;

  // Limits (flattened)
  maxRepos: number;
  maxTasks: number;
  maxTokensPerMonth: number;

  // Stripe integration
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  periodEnd: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended subscription API response with usage data
 */
export interface SubscriptionWithUsageApiResponse extends SubscriptionApiResponse {
  // Usage summary
  usage: UsageSummary;

  // Limit status
  reposUsed: number;
  tasksUsed: number;
  tokensUsed: number;

  // Limit checks
  reposLimitReached: boolean;
  tasksLimitReached: boolean;
  tokensLimitReached: boolean;
}

/**
 * API request format for creating/updating subscription
 */
export interface UpdateSubscriptionRequest {
  planTier?: PlanTier;
  billingMode?: BillingMode;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/**
 * Subscription adapter - maps between domain and API formats
 */
export class SubscriptionAdapter {
  /**
   * Convert domain state to API response format
   *
   * Flattens nested limits structure to match existing API contract.
   * Frontend expects flat structure with individual limit fields.
   */
  static toApiResponse(state: SubscriptionState): SubscriptionApiResponse {
    return {
      // Identity
      id: state.id,
      userId: state.userId,

      // Plan information
      planTier: state.planTier,
      billingMode: state.billingMode,
      status: state.status,

      // Limits (flattened)
      maxRepos: state.limits.maxRepos,
      maxTasks: state.limits.maxTasks,
      maxTokensPerMonth: state.limits.maxTokensPerMonth,

      // Stripe integration
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      periodEnd: state.periodEnd,

      // Timestamps
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  /**
   * Convert domain state to API response with usage data
   *
   * Includes usage summary and limit check results.
   */
  static toApiResponseWithUsage(
    state: SubscriptionState,
    usage: UsageSummary,
    currentCounts: {
      repos: number;
      tasks: number;
    },
  ): SubscriptionWithUsageApiResponse {
    const basic = SubscriptionAdapter.toApiResponse(state);

    // Calculate limit checks
    const reposLimitReached =
      state.limits.maxRepos !== -1 &&
      currentCounts.repos >= state.limits.maxRepos;

    const tasksLimitReached =
      state.limits.maxTasks !== -1 &&
      currentCounts.tasks >= state.limits.maxTasks;

    const tokensLimitReached =
      state.limits.maxTokensPerMonth !== -1 &&
      usage.totalTokens >= state.limits.maxTokensPerMonth;

    return {
      ...basic,

      // Usage summary
      usage,

      // Current usage
      reposUsed: currentCounts.repos,
      tasksUsed: currentCounts.tasks,
      tokensUsed: usage.totalTokens,

      // Limit checks
      reposLimitReached,
      tasksLimitReached,
      tokensLimitReached,
    };
  }

  /**
   * Convert API request to partial subscription state
   *
   * Extracts only fields that can be updated.
   * Only includes provided fields (partial update support).
   */
  static fromUpdateRequest(body: UpdateSubscriptionRequest): {
    planTier?: PlanTier;
    billingMode?: BillingMode;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  } {
    const result: {
      planTier?: PlanTier;
      billingMode?: BillingMode;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    } = {};

    if (body.planTier !== undefined) {
      result.planTier = body.planTier;
    }

    if (body.billingMode !== undefined) {
      result.billingMode = body.billingMode;
    }

    if (body.stripeCustomerId !== undefined) {
      result.stripeCustomerId = body.stripeCustomerId;
    }

    if (body.stripeSubscriptionId !== undefined) {
      result.stripeSubscriptionId = body.stripeSubscriptionId;
    }

    return result;
  }

  /**
   * Convert flat database row to domain SubscriptionState
   *
   * Used when loading subscription from database during migration.
   * Maps flat columns to domain structure.
   */
  static fromDatabaseRow(row: {
    id: string;
    userId: string;
    planTier?: PlanTier | null;
    billingMode?: BillingMode | null;
    status?: SubscriptionStatus | null;
    maxRepos?: number | null;
    maxTasks?: number | null;
    maxTokensPerMonth?: number | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    periodEnd?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionState {
    // Build limits
    const limits: PlanLimits = {
      maxRepos: row.maxRepos ?? 1, // Default to free tier
      maxTasks: row.maxTasks ?? 5,
      maxTokensPerMonth: row.maxTokensPerMonth ?? 100000,
    };

    return {
      id: row.id,
      userId: row.userId,
      planTier: row.planTier ?? "free",
      billingMode: row.billingMode ?? "byok",
      status: row.status ?? "active",
      limits,
      stripeCustomerId: row.stripeCustomerId ?? null,
      stripeSubscriptionId: row.stripeSubscriptionId ?? null,
      periodEnd: row.periodEnd ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Convert flat database row from users table
   *
   * Legacy support for subscription data stored in users table.
   * Maps flat user columns to subscription domain structure.
   */
  static fromUserTableRow(row: {
    id: string; // Will be used as userId
    billingMode?: string | null;
    subscriptionTier?: string | null;
    subscriptionStatus?: string | null;
    subscriptionPeriodEnd?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionState {
    // Parse plan tier from subscription tier
    let planTier: PlanTier = "free";
    if (
      row.subscriptionTier === "pro" ||
      row.subscriptionTier === "enterprise"
    ) {
      planTier = row.subscriptionTier;
    }

    // Parse billing mode
    let billingMode: BillingMode = "byok";
    if (row.billingMode === "managed") {
      billingMode = "managed";
    }

    // Parse status
    let status: SubscriptionStatus = "active";
    if (
      row.subscriptionStatus === "past_due" ||
      row.subscriptionStatus === "canceled" ||
      row.subscriptionStatus === "trialing"
    ) {
      status = row.subscriptionStatus;
    }

    // Get limits based on plan tier
    const limitsMap: Record<PlanTier, PlanLimits> = {
      free: { maxRepos: 1, maxTasks: 5, maxTokensPerMonth: 100000 },
      pro: { maxRepos: 20, maxTasks: 100, maxTokensPerMonth: 5000000 },
      enterprise: { maxRepos: -1, maxTasks: -1, maxTokensPerMonth: -1 },
    };

    return {
      id: `sub-${row.id}`, // Generate subscription ID from user ID
      userId: row.id,
      planTier,
      billingMode,
      status,
      limits: limitsMap[planTier],
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      periodEnd: row.subscriptionPeriodEnd ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
