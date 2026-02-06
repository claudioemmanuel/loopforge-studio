/**
 * Analytics Service Adapter
 * Implements IAnalyticsService port by delegating to the real analytics service
 */

import type { IAnalyticsService } from "../../use-cases/ports/IAnalyticsService";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";

export class AnalyticsServiceAdapter implements IAnalyticsService {
  private readonly analytics = getAnalyticsService();

  async trackEvent(
    eventName: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    // Map generic event to specific analytics methods
    switch (eventName) {
      case "task_created":
        await this.analytics.taskCreated({
          taskId: properties.taskId as string,
          repoId: properties.repoId as string,
          userId: properties.userId as string,
          taskTitle: properties.taskTitle as string,
        });
        break;

      case "task_completed":
        await this.analytics.taskCompleted({
          taskId: properties.taskId as string,
          repoId: properties.repoId as string,
          userId: properties.userId as string,
          taskTitle: properties.taskTitle as string,
          hasPr: properties.hasPr as boolean,
        });
        break;

      case "task_deleted":
        // Analytics service doesn't have taskDeleted yet, skip for now
        break;

      case "tasks_bulk_deleted":
        // Analytics service doesn't have bulk delete tracking yet, skip for now
        break;

      default:
        // Unknown event, ignore
        break;
    }
  }
}
