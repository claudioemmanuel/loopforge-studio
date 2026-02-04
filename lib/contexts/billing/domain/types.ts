/**
 * Billing Domain Types
 *
 * Re-exports from the existing billing domain module so the bounded context
 * has a single internal import surface.
 */

export {
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
  type LimitCheckResult,
  getPlanConfig,
  isUnlimited,
  getLimit,
  formatLimitError,
  getMaxReposForTier,
  getMaxTasksForTier,
} from "@/lib/billing/domain/limits";

export {
  type UsageSummary,
  calculateTokenCost,
  formatTokens,
  formatCost,
} from "@/lib/billing/domain/usage";
