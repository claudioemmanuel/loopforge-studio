/**
 * Analytics Service (Application Layer)
 *
 * Orchestrates analytics operations and coordinates with infrastructure.
 * Public API for Analytics bounded context.
 */

import type { Redis } from "ioredis";
import { ActivityRepository } from "../infrastructure/activity-repository";
import { AnalyticsEventSubscriber } from "../infrastructure/event-subscribers";
import type {
  ActivityEvent,
  ActivityFilter,
  ActivitySummary,
  SummaryFilter,
  ActivityMetrics,
  TimePeriod,
} from "../domain/types";

/**
 * Analytics service
 */
export class AnalyticsService {
  private activityRepository: ActivityRepository;
  private eventSubscriber: AnalyticsEventSubscriber;

  constructor(redis: Redis) {
    this.activityRepository = new ActivityRepository(redis);
    this.eventSubscriber = new AnalyticsEventSubscriber(redis);
  }

  /**
   * Start analytics event subscriber
   */
  async start(): Promise<void> {
    await this.eventSubscriber.start();
  }

  /**
   * Stop analytics event subscriber
   */
  async stop(): Promise<void> {
    await this.eventSubscriber.stop();
  }

  /**
   * Get activities by filter
   */
  async getActivities(filter: ActivityFilter): Promise<ActivityEvent[]> {
    return this.activityRepository.findActivities(filter);
  }

  /**
   * Get recent activities for user
   */
  async getRecentActivities(
    userId: string,
    limit: number = 50,
  ): Promise<ActivityEvent[]> {
    return this.activityRepository.findRecentActivities(userId, limit);
  }

  /**
   * Get summaries by filter
   */
  async getSummaries(filter: SummaryFilter): Promise<ActivitySummary[]> {
    return this.activityRepository.findSummaries(filter);
  }

  /**
   * Generate daily summary for user
   */
  async generateDailySummary(
    userId: string,
    date?: Date,
  ): Promise<ActivitySummary> {
    return this.activityRepository.generateDailySummary(userId, date);
  }

  /**
   * Get activity metrics
   */
  async getMetrics(
    userId: string,
    period: TimePeriod = "week",
  ): Promise<ActivityMetrics> {
    return this.activityRepository.getMetrics(userId, period);
  }

  /**
   * Get activity count for user
   */
  async getActivityCount(userId: string, period?: TimePeriod): Promise<number> {
    const filter: ActivityFilter = { userId };

    if (period) {
      const { getTimeRange } = await import("../domain/types");
      const { start, end } = getTimeRange(period);
      filter.startDate = start;
      filter.endDate = end;
    }

    const activities = await this.activityRepository.findActivities(filter);
    return activities.length;
  }
}
