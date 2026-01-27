import { Queue, Worker, Job } from "bullmq";
import { connectionOptions, createConnectionOptions } from "./connection";

export interface IndexingJobData {
  repoId: string;
  userId: string;
  localPath: string;
  repoName: string;
}

export interface IndexingJobResult {
  success: boolean;
  fileCount?: number;
  symbolCount?: number;
  error?: string;
  completedAt: Date;
}

// Queue for indexing jobs
export const indexingQueue = new Queue<IndexingJobData, IndexingJobResult>(
  "indexing",
  { connection: connectionOptions },
);

// Add a job to the queue
export async function queueIndexing(
  data: IndexingJobData,
): Promise<Job<IndexingJobData, IndexingJobResult>> {
  return indexingQueue.add("indexing", data, {
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 50,
    },
  });
}

// Get job status
export async function getIndexingJobStatus(jobId: string) {
  const job = await indexingQueue.getJob(jobId);
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
export function createIndexingWorker(
  processor: (
    job: Job<IndexingJobData, IndexingJobResult>,
  ) => Promise<IndexingJobResult>,
) {
  return new Worker<IndexingJobData, IndexingJobResult>("indexing", processor, {
    connection: createConnectionOptions(),
    concurrency: 2, // Process up to 2 indexing jobs at a time
  });
}
