/**
 * Task Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { TaskService } from "../application/task-service";

export function getTaskService(): TaskService {
  const redis = getRedis();
  return new TaskService(redis);
}

export { TaskService } from "../application/task-service";

// Re-export types for use in presentation layer
export type { Task, TaskStatus, StatusHistoryEntry } from "@/lib/db/schema";
