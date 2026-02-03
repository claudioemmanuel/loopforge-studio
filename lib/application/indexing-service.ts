import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db, repoIndex, repos } from "@/lib/db";
import { indexRepository } from "@/lib/indexing";
import { workerLogger } from "@/lib/logger";
import type { IndexingJobData, IndexingJobResult } from "@/lib/queue";

export async function processIndexingJob(
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

    return {
      success: false,
      error: errorMessage,
      completedAt: new Date(),
    };
  }
}
