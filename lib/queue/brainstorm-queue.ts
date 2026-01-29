import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";

export interface BrainstormJobData {
  taskId: string;
  userId: string;
  repoId: string;
  continueToPlanning: boolean; // For autonomous mode
}

export interface BrainstormJobResult {
  success: boolean;
  brainstormResult?: string;
  error?: string;
  completedAt: Date;
}

// Queue for brainstorm jobs
export const brainstormQueue = new Queue<
  BrainstormJobData,
  BrainstormJobResult
>("brainstorm", { connection: connectionOptions });

// Add a job to the queue
export async function queueBrainstorm(
  data: BrainstormJobData,
): Promise<Job<BrainstormJobData, BrainstormJobResult>> {
  return brainstormQueue.add("brainstorm", data, {
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  });
}

// Get job status
export async function getBrainstormJobStatus(jobId: string) {
  const job = await brainstormQueue.getJob(jobId);
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
export function createBrainstormWorker(
  processor: (
    job: Job<BrainstormJobData, BrainstormJobResult>,
  ) => Promise<BrainstormJobResult>,
) {
  return new Worker<BrainstormJobData, BrainstormJobResult>(
    "brainstorm",
    processor,
    {
      connection: createConnectionOptions(),
      concurrency: 3, // Process up to 3 jobs at a time
    },
  );
}
