/**
 * Task Service (Application Layer)
 *
 * Delegates persistence to infrastructure adapter.
 */

import type { Redis } from "ioredis";
import {
  TaskPersistenceAdapter,
  getWorkerStatusesForFilter,
} from "../infrastructure/task-persistence-adapter";

export { getWorkerStatusesForFilter };

export class TaskService extends TaskPersistenceAdapter {
  constructor(redis: Redis) {
    super(redis);
  }
}
