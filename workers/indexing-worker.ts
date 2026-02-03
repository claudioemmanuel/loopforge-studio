/**
 * Indexing Worker
 *
 * Processes repository indexing jobs triggered after clone completion.
 * Updates repos.indexingStatus and creates repo_index records.
 */

import { Job } from "bullmq";
import { db, repos, repoIndex } from "../lib/db";
import { eq } from "drizzle-orm";
import {
  createIndexingWorker,
  type IndexingJobData,
  type IndexingJobResult,
} from "../lib/queue";
import { indexRepository } from "../lib/indexing";
import { workerLogger } from "../lib/logger";
import { createDomainEvent } from "../lib/domain-events/bus";
import { initDomainEventSystem } from "../lib/application/event-system";

async function processIndexing(
  job: Job<IndexingJobData, IndexingJobResult>,
): Promise<IndexingJobResult> {
  const { repoId, localPath, repoName } = job.data;

  workerLogger.info({ repoId, repoName }, "Starting repository indexing");

  try {
    // Update repo status to indexing
    await db
      .update(repos)
      .set({
        indexingStatus: "indexing",
        updatedAt: new Date(),
      })
      .where(eq(repos.id, repoId));

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

    // Check if repo_index record exists
    const existingIndex = await db.query.repoIndex.findFirst({
      where: eq(repoIndex.repoId, repoId),
    });

    if (existingIndex) {
      // Update existing index
      await db
        .update(repoIndex)
        .set({
          fileCount: result.fileCount,
          symbolCount: result.symbolCount,
          techStack: result.techStack,
          entryPoints: result.entryPoints,
          dependencies: result.dependencies,
          fileIndex: result.fileIndex,
          updatedAt: new Date(),
        })
        .where(eq(repoIndex.repoId, repoId));
    } else {
      // Create new index record
      await db.insert(repoIndex).values({
        repoId,
        fileCount: result.fileCount,
        symbolCount: result.symbolCount,
        techStack: result.techStack,
        entryPoints: result.entryPoints,
        dependencies: result.dependencies,
        fileIndex: result.fileIndex,
      });
    }

    // Update repo status to indexed
    await db
      .update(repos)
      .set({
        indexingStatus: "indexed",
        indexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(repos.id, repoId));

    const bus = initDomainEventSystem();
    await bus.publish(
      createDomainEvent("RepoIndexed", {
        repoId,
        userId: job.data.userId,
        success: true,
        fileCount: result.fileCount,
      }),
    );

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

    // Update repo status to failed
    await db
      .update(repos)
      .set({
        indexingStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(repos.id, repoId));

    const bus = initDomainEventSystem();
    await bus.publish(
      createDomainEvent("RepoIndexed", {
        repoId,
        userId: job.data.userId,
        success: false,
        error: errorMessage,
      }),
    );

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
