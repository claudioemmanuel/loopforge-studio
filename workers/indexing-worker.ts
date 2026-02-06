/**
 * Indexing Worker
 *
 * Processes repository indexing jobs triggered after clone completion.
 * Updates repos.indexingStatus and creates repo_index records.
 */

import { IndexingService } from "../lib/contexts/repository/application/indexing-service";
import { workerLogger } from "../lib/logger";
import { createIndexingWorker, getRedis } from "../lib/queue";
import type { Job } from "bullmq";
import type { IndexingJobData, IndexingJobResult } from "../lib/queue";

async function processIndexingJob(
  job: Job<IndexingJobData, IndexingJobResult>,
): Promise<IndexingJobResult> {
  const redis = getRedis();
  const indexingService = new IndexingService(redis);

  try {
    await indexingService.completeIndexingWithResult({
      repositoryId: job.data.repoId,
      result: {
        fileCount: 0,
        symbolCount: 0,
        techStack: {
          languages: [],
          frameworks: [],
          buildTools: [],
        },
        entryPoints: [],
        dependencies: [],
        fileIndex: [],
      },
    });

    return {
      success: true,
      fileCount: 0,
      symbolCount: 0,
      completedAt: new Date(),
    };
  } catch (error) {
    await indexingService.failIndexing({
      repositoryId: job.data.repoId,
      error: error instanceof Error ? error.message : "Unknown indexing error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown indexing error",
      completedAt: new Date(),
    };
  }
}

// Create and start the indexing worker
const worker = createIndexingWorker(processIndexingJob);

worker.on("completed", (job, result) => {
  workerLogger.info(
    {
      jobId: job.id,
      success: result.success,
      fileCount: result.fileCount,
    },
    "Indexing job completed",
  );
});

worker.on("failed", (job, err) => {
  workerLogger.error(
    { jobId: job?.id, error: err.message },
    "Indexing job failed",
  );
});

worker.on("error", (err) => {
  workerLogger.error({ error: err }, "Indexing worker error");
});

workerLogger.info("Indexing worker started");

export { worker };
export default worker;
