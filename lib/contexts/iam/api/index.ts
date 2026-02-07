/**
 * IAM Context API (Public Interface)
 *
 * Service factory and type exports for IAM bounded context.
 */

import { getRedis } from "@/lib/queue/connection";
import { UserService } from "../application/user-service";

/**
 * Get UserService instance
 * Stateless service - safe to create per request
 */
export function getUserService(): UserService {
  const redis = getRedis();
  return new UserService(redis);
}

// Re-export for convenience
export { UserService } from "../application/user-service";
export type { UserState } from "../domain/user-aggregate";
export {
  aiProviders,
  type AiProvider,
  type SubscriptionTier,
  type BillingMode,
  type SubscriptionStatus,
  type TestGatePolicy,
} from "../domain/types";
