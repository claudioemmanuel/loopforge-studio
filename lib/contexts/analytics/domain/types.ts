/**
 * Analytics Domain Types
 *
 * Value objects and types for the Analytics context.
 */

/**
 * Activity event category
 */
export type ActivityCategory = "ai_action" | "git" | "system";

/**
 * Activity event
 */
export interface ActivityEvent {
  id: string;
  userId?: string;
  taskId?: string;
  repoId?: string;
  executionId?: string;
  eventType: string;
  category: ActivityCategory;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Activity summary (daily/weekly/monthly)
 */
export interface ActivitySummary {
  id: string;
  userId: string;
  repoId?: string;
  date: Date;
  tasksCompleted: number;
  tasksFailed: number;
  commits: number;
  filesChanged: number;
  tokensUsed: number;
  summaryText?: string;
  createdAt: Date;
}

/**
 * Time period for aggregation
 */
export type TimePeriod = "day" | "week" | "month" | "year";

/**
 * Activity filter
 */
export interface ActivityFilter {
  userId?: string;
  repoId?: string;
  taskId?: string;
  executionId?: string;
  category?: ActivityCategory;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Summary filter
 */
export interface SummaryFilter {
  userId?: string;
  repoId?: string;
  period?: TimePeriod;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Activity metrics
 */
export interface ActivityMetrics {
  totalActivities: number;
  activitiesByCategory: Record<ActivityCategory, number>;
  activitiesByDay: Array<{ date: Date; count: number }>;
  topTasks: Array<{ taskId: string; title: string; activityCount: number }>;
  topRepos: Array<{ repoId: string; name: string; activityCount: number }>;
}

/**
 * SSE event for real-time updates
 */
export interface SSEEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Get time range for period
 */
export function getTimeRange(
  period: TimePeriod,
  date: Date = new Date(),
): { start: Date; end: Date } {
  const start = new Date(date);
  const end = new Date(date);

  switch (period) {
    case "day":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "week":
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + (6 - dayOfWeek));
      end.setHours(23, 59, 59, 999);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}
