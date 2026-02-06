/**
 * Execution Service (Application Layer)
 *
 * Delegates persistence and data access to infrastructure adapter.
 */

import type { Redis } from "ioredis";
import { ExecutionPersistenceAdapter } from "../infrastructure/execution-persistence-adapter";

export class ExecutionService extends ExecutionPersistenceAdapter {
  constructor(redis: Redis) {
    super(redis);
  }
}
