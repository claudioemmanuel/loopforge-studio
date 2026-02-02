/**
 * Analytics Context API
 *
 * Public API for interacting with the Analytics bounded context.
 * Provides backward-compatible interface for existing code.
 */

import { Redis } from "ioredis";
import { AnalyticsService } from "../application/analytics-service";
import {
  getSSEStreamManager,
  type SSEConnection,
} from "../infrastructure/sse-stream";
import type {
  ActivityEvent,
  ActivityFilter,
  ActivitySummary,
  SummaryFilter,
  ActivityMetrics,
  TimePeriod,
} from "../domain/types";

// Singleton Redis instance for Analytics context
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(
      process.env.REDIS_URL || "redis://localhost:6379",
    );
  }
  return redisInstance;
}

// Singleton AnalyticsService instance
let analyticsServiceInstance: AnalyticsService | null = null;

/**
 * Get analytics service instance
 */
export function getAnalyticsService(): AnalyticsService {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = new AnalyticsService(getRedis());
  }
  return analyticsServiceInstance;
}

/**
 * Start analytics event subscriber
 */
export async function startAnalyticsSubscriber(): Promise<void> {
  const analyticsService = getAnalyticsService();
  await analyticsService.start();
}

/**
 * Stop analytics event subscriber
 */
export async function stopAnalyticsSubscriber(): Promise<void> {
  const analyticsService = getAnalyticsService();
  await analyticsService.stop();
}

/**
 * Get activities by filter
 */
export async function getActivities(
  filter: ActivityFilter,
): Promise<ActivityEvent[]> {
  const analyticsService = getAnalyticsService();
  return analyticsService.getActivities(filter);
}

/**
 * Get recent activities for user
 */
export async function getRecentActivities(
  userId: string,
  limit: number = 50,
): Promise<ActivityEvent[]> {
  const analyticsService = getAnalyticsService();
  return analyticsService.getRecentActivities(userId, limit);
}

/**
 * Get summaries by filter
 */
export async function getSummaries(
  filter: SummaryFilter,
): Promise<ActivitySummary[]> {
  const analyticsService = getAnalyticsService();
  return analyticsService.getSummaries(filter);
}

/**
 * Generate daily summary for user
 */
export async function generateDailySummary(
  userId: string,
  date?: Date,
): Promise<ActivitySummary> {
  const analyticsService = getAnalyticsService();
  return analyticsService.generateDailySummary(userId, date);
}

/**
 * Get activity metrics
 */
export async function getActivityMetrics(
  userId: string,
  period: TimePeriod = "week",
): Promise<ActivityMetrics> {
  const analyticsService = getAnalyticsService();
  return analyticsService.getMetrics(userId, period);
}

/**
 * Get activity count for user
 */
export async function getActivityCount(
  userId: string,
  period?: TimePeriod,
): Promise<number> {
  const analyticsService = getAnalyticsService();
  return analyticsService.getActivityCount(userId, period);
}

/**
 * Add SSE connection
 */
export function addSSEConnection(connection: SSEConnection): void {
  const manager = getSSEStreamManager(getRedis());
  manager.addConnection(connection);
}

/**
 * Remove SSE connection
 */
export function removeSSEConnection(connectionId: string): void {
  const manager = getSSEStreamManager(getRedis());
  manager.removeConnection(connectionId);
}

/**
 * Get active SSE connection count
 */
export function getSSEConnectionCount(): number {
  const manager = getSSEStreamManager(getRedis());
  return manager.getConnectionCount();
}

// Re-export domain types for convenience
export type {
  ActivityEvent,
  ActivityFilter,
  ActivitySummary,
  SummaryFilter,
  ActivityMetrics,
  ActivityCategory,
  TimePeriod,
} from "../domain/types";
export { getTimeRange } from "../domain/types";
