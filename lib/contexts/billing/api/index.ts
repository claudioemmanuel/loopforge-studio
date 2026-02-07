/**
 * Billing Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue/connection";
import { BillingService } from "../application/billing-service";
import { SubscriptionRepository } from "../infrastructure/subscription-repository";
import { UsageRepository } from "../infrastructure/usage-repository";
import { getTaskService } from "../../task/api";
import { getRepositoryService } from "../../repository/api";

/**
 * Get BillingService instance.
 * Wired with repository and service dependencies.
 */
export function getBillingService(): BillingService {
  const redis = getRedis();
  const subscriptionRepository = new SubscriptionRepository(redis);
  const usageRepository = new UsageRepository(redis);
  const taskService = getTaskService();
  const repositoryService = getRepositoryService();

  return new BillingService(
    subscriptionRepository,
    usageRepository,
    taskService,
    repositoryService,
  );
}

export { BillingService } from "../application/billing-service";
export type { SubscriptionTier } from "../domain/types";
export {
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  getMaxReposForTier,
  getMaxTasksForTier,
} from "../domain/types";
