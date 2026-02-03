import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";
import {
  type AutonomousFlowJobData,
  type AutonomousFlowJobResult,
  processAutonomousFlow,
} from "@/lib/application/autonomous-flow";

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
export type { AutonomousFlowJobData, AutonomousFlowJobResult };
export { processAutonomousFlow };
