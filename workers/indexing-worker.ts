/**
 * Indexing Worker
 *
 * Processes repository indexing jobs triggered after clone completion.
 * Updates repos.indexingStatus and creates repo_index records.
 */

import { Job } from "bullmq";
import {
  createIndexingWorker,
  type IndexingJobData,
  type IndexingJobResult,
} from "../lib/queue";
import { indexRepository } from "../lib/indexing";
import { workerLogger } from "../lib/logger";
import {
  getIndexingService,
  getRepositoryService,
} from "../lib/contexts/repository/api";

async function processIndexing(
  job: Job<IndexingJobData, IndexingJobResult>,
): Promise<IndexingJobResult> {
  const { repoId, localPath, repoName } = job.data;
  const repositoryService = getRepositoryService();
  const indexingService = getIndexingService();

  workerLogger.info({ repoId, repoName }, "Starting repository indexing");

  try {
    // Update repo status to indexing
    await repositoryService.updateIndexingStatus({
      repositoryId: repoId,
      status: "indexing",
    });

    await indexingService.startIndexing(repoId);

    // Update job progress
    await job.updateProgress({
      phase: "scanning",
      filesScanned: 0,
    });

    // Run indexing
    const result = await indexRepository(localPath, async (progress) => {
      await job.updateProgress(progress);
    });

    workerLogger.info(
      {
        repoId,
        repoName,
        fileCount: result.fileCount,
        languages: result.techStack.languages,
        frameworks: result.techStack.frameworks,
      },
      "Indexing complete",
    );

    await indexingService.completeIndexingWithResult({
      repositoryId: repoId,
      result,
    });

    // Update repo status to indexed
    await repositoryService.updateIndexingStatus({
      repositoryId: repoId,
      status: "indexed",
      indexedAt: new Date(),
    });

    return {
      success: true,
      fileCount: result.fileCount,
      symbolCount: result.symbolCount,
      completedAt: new Date(),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    workerLogger.error(
      { repoId, repoName, error: errorMessage },
      "Indexing failed",
    );

    await repositoryService.updateIndexingStatus({
      repositoryId: repoId,
      status: "failed",
    });

    await indexingService.failIndexing({
      repositoryId: repoId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
      completedAt: new Date(),
    };
  }
}

// Create and start the indexing worker
const worker = createIndexingWorker(processIndexing);

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
