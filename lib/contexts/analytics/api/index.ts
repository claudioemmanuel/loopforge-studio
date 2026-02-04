/**
 * Analytics Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { AnalyticsService } from "../application/analytics-service";

/**
 * Get AnalyticsService instance.
 * Stateless – safe to create per request.
 */
export function getAnalyticsService(): AnalyticsService {
  const redis = getRedis();
  return new AnalyticsService(redis);
}

export { AnalyticsService } from "../application/analytics-service";
export type { RecordActivityEventParams } from "../application/analytics-service";
