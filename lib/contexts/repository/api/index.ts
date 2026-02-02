/**
 * Repository Management API (Public Interface)
 *
 * Backward-compatible wrapper for existing code.
 * Re-exports repository services for easy consumption.
 */

import { getRedis } from "@/lib/queue";
import { RepositoryService } from "../application/repository-service";
import { IndexingService } from "../application/indexing-service";
import type {
  RepositoryMetadata,
  TestConfiguration,
  PRConfiguration,
} from "../domain/types";

/**
 * Get repository service instance
 */
export function getRepositoryService(): RepositoryService {
  const redis = getRedis();
  return new RepositoryService(redis);
}

/**
 * Get indexing service instance
 */
export function getIndexingService(): IndexingService {
  const redis = getRedis();
  return new IndexingService(redis);
}

/**
 * Re-export types for convenience
 */
export type {
  RepositoryMetadata,
  TestConfiguration,
  PRConfiguration,
} from "../domain/types";

/**
 * Re-export enums and constants
 */
export { DEFAULT_TEST_CONFIG, DEFAULT_PR_CONFIG } from "../domain/types";
