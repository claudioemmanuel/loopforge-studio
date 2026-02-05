/**
 * Billing Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { BillingService } from "../application/billing-service";

/**
 * Get BillingService instance.
 * Stateless – safe to create per request.
 */
export function getBillingService(): BillingService {
  const redis = getRedis();
  return new BillingService(redis);
}

export { BillingService } from "../application/billing-service";
export type { SubscriptionTier } from "../domain/types";
export {
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  getMaxReposForTier,
  getMaxTasksForTier,
} from "../domain/types";
