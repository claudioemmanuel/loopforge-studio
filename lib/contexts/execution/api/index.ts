/**
 * Execution Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { ExecutionService } from "../application/execution-service";
import { WorkerMonitoringService } from "../application/worker-monitoring-service";

export function getExecutionService(): ExecutionService {
  const redis = getRedis();
  return new ExecutionService(redis);
}

export function getWorkerMonitoringService(): WorkerMonitoringService {
  const redis = getRedis();
  return new WorkerMonitoringService(redis);
}

export { ExecutionService } from "../application/execution-service";
export { WorkerMonitoringService } from "../application/worker-monitoring-service";
export {
  processingPhases,
  workerJobPhases,
  type ExecutionStatus,
  type ProcessingPhase,
  type WorkerJobPhase,
} from "../domain/types";
