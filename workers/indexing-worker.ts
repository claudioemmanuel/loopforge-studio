/**
 * Indexing Worker
 *
 * Processes repository indexing jobs triggered after clone completion.
 * Updates repos.indexingStatus and creates repo_index records.
 */

import { processIndexingJob } from "../lib/application/indexing-service";
import { workerLogger } from "../lib/logger";
import { createIndexingWorker } from "../lib/queue";

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
