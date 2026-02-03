/**
 * Execution Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { ExecutionService } from "../application/execution-service";

export function getExecutionService(): ExecutionService {
  const redis = getRedis();
  return new ExecutionService(redis);
}

export { ExecutionService } from "../application/execution-service";
