import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";
import type { AiProvider } from "@/lib/db/schema";

export interface ExecutionJobData {
  executionId: string;
  taskId: string;
  repoId: string;
  userId: string;
  apiKey: string;
  aiProvider: AiProvider;
  preferredModel: string;
  planContent: string;
  branch: string;
  cloneUrl: string;
}

export interface ExecutionJobResult {
  success: boolean;
  commits?: string[];
  error?: string;
  completedAt: Date;
}

// Queue for execution jobs
export const executionQueue = new Queue<ExecutionJobData, ExecutionJobResult>(
  "execution",
  { connection: connectionOptions }
);

// Add a job to the queue
export async function queueExecution(data: ExecutionJobData): Promise<Job<ExecutionJobData, ExecutionJobResult>> {
  return executionQueue.add("execute", data, {
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  });
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await executionQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress,
    data: job.data,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

// Create worker (to be used in separate process)
export function createExecutionWorker(
  processor: (job: Job<ExecutionJobData, ExecutionJobResult>) => Promise<ExecutionJobResult>
) {
  return new Worker<ExecutionJobData, ExecutionJobResult>(
    "execution",
    processor,
    {
      connection: createConnectionOptions(),
      concurrency: 1, // Process one job at a time
    }
  );
}
