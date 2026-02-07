/**
 * Execution Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { ExecutionService } from "../application/execution-service";
import { WorkerMonitoringService } from "../application/worker-monitoring-service";
import { ApproveDiffUseCase } from "../use-cases/approve-diff/ApproveDiffUseCase";
import { getTaskService } from "../../task/api";

export function getExecutionService(): ExecutionService {
  const redis = getRedis();
  return new ExecutionService(redis);
}

export function getWorkerMonitoringService(): WorkerMonitoringService {
  const redis = getRedis();
  return new WorkerMonitoringService(redis);
}

/**
 * Use Case Factories
 */
export function getApproveDiffUseCase(): ApproveDiffUseCase {
  const executionService = getExecutionService();
  const taskService = getTaskService();
  return new ApproveDiffUseCase(executionService, taskService);
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
