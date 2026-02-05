/**
 * Billing Context API (Public Interface)
 */

import { BillingService } from "../application/billing-service";

/**
 * Get BillingService instance.
 * Stateless – safe to create per request.
 */
export function getBillingService(): BillingService {
  return new BillingService();
}

export { BillingService } from "../application/billing-service";
export type { SubscriptionTier } from "../domain/types";
export {
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  getMaxReposForTier,
  getMaxTasksForTier,
} from "../domain/types";
