import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";
import type { ProgressReporter } from "@/lib/application/ports/progress-reporter";
import {
  AutonomousFlowService,
  type AutonomousFlowJobData,
  type AutonomousFlowJobResult,
} from "@/lib/application/services/autonomous-flow-service";
import { DefaultAIGateway } from "@/lib/infra/gateways/ai-gateway";
import { DefaultAISettingsGateway } from "@/lib/infra/gateways/ai-settings-gateway";
import { DefaultCryptoGateway } from "@/lib/infra/gateways/crypto-gateway";
import { DefaultGitHubGateway } from "@/lib/infra/gateways/github-gateway";
import { ExecutionQueueGateway } from "@/lib/infra/gateways/queue-gateway";
import { DefaultWorkerEventsGateway } from "@/lib/infra/gateways/worker-events-gateway";
import { QueueLoggerAdapter } from "@/lib/infra/logger/queue-logger-adapter";
import { DrizzleExecutionRepository } from "@/lib/infra/repositories/drizzle-execution-repository";
import { DrizzleRepoRepository } from "@/lib/infra/repositories/drizzle-repo-repository";
import { DrizzleTaskRepository } from "@/lib/infra/repositories/drizzle-task-repository";
import { DrizzleUserRepository } from "@/lib/infra/repositories/drizzle-user-repository";

export type {
  AutonomousFlowJobData,
  AutonomousFlowJobResult,
} from "@/lib/application/services/autonomous-flow-service";

// Queue for autonomous flow jobs
export const autonomousFlowQueue = new Queue<
  AutonomousFlowJobData,
  AutonomousFlowJobResult
>("autonomous-flow", { connection: connectionOptions });

// Add a job to the queue
export async function queueAutonomousFlow(
  data: AutonomousFlowJobData,
): Promise<Job<AutonomousFlowJobData, AutonomousFlowJobResult>> {
  return autonomousFlowQueue.add("autonomous", data, {
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 50,
    },
  });
}

// Process autonomous flow
class BullmqProgressReporter implements ProgressReporter {
  constructor(private readonly job: Job<AutonomousFlowJobData, AutonomousFlowJobResult>) {}

  async updateProgress(details: { step: string; progress: number }): Promise<void> {
    await this.job.updateProgress(details);
  }
}

function createAutonomousFlowService() {
  return new AutonomousFlowService({
    taskRepository: new DrizzleTaskRepository(),
    executionRepository: new DrizzleExecutionRepository(),
    repoRepository: new DrizzleRepoRepository(),
    userRepository: new DrizzleUserRepository(),
    aiGateway: new DefaultAIGateway(),
    aiSettingsGateway: new DefaultAISettingsGateway(),
    githubGateway: new DefaultGitHubGateway(),
    queueGateway: new ExecutionQueueGateway(),
    workerEventsGateway: new DefaultWorkerEventsGateway(),
    cryptoGateway: new DefaultCryptoGateway(),
    logger: new QueueLoggerAdapter(),
  });
}

async function processAutonomousFlow(
  job: Job<AutonomousFlowJobData, AutonomousFlowJobResult>,
): Promise<AutonomousFlowJobResult> {
  const service = createAutonomousFlowService();
  return service.run(job.data, new BullmqProgressReporter(job));
}

// Create worker
export function createAutonomousFlowWorker() {
  return new Worker<AutonomousFlowJobData, AutonomousFlowJobResult>(
    "autonomous-flow",
    processAutonomousFlow,
    {
      connection: createConnectionOptions(),
      concurrency: 2, // Allow 2 autonomous flows at a time
    },
  );
}

// Export for use in worker process
export { processAutonomousFlow };
