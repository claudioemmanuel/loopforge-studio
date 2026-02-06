import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";

export interface PlanJobData {
  taskId: string;
  userId: string;
  repoId: string;
  brainstormResult: string; // JSON string of brainstorm
  continueToExecution: boolean; // For autonomous mode
  // Repository context for AI planning
  repoName: string;
  repoFullName: string;
  repoDefaultBranch: string;
  techStack?: string[];
}

export interface PlanJobResult {
  success: boolean;
  planContent?: string;
  branch?: string;
  error?: string;
  completedAt: Date;
}

type PlanJobName = "plan";

// Queue for plan jobs
export const planQueue = new Queue<PlanJobData, PlanJobResult, PlanJobName>(
  "plan",
  {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  },
);

// Add a job to the queue
export async function queuePlan(
  data: PlanJobData,
): Promise<Job<PlanJobData, PlanJobResult, PlanJobName>> {
  return planQueue.add("plan", data, {
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  });
}

// Get job status
export async function getPlanJobStatus(jobId: string) {
  const job = await planQueue.getJob(jobId);
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
export function createPlanWorker(
  processor: (
    job: Job<PlanJobData, PlanJobResult, string>,
  ) => Promise<PlanJobResult>,
) {
  return new Worker<PlanJobData, PlanJobResult>("plan", processor, {
    connection: createConnectionOptions(),
    concurrency: 3, // Process up to 3 jobs at a time
  });
}
