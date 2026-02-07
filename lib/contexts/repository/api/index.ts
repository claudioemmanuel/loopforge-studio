/**
 * Repository Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue/connection";
import { RepositoryService } from "../application/repository-service";

export function getRepositoryService(): RepositoryService {
  const redis = getRedis();
  return new RepositoryService(redis);
}

export { RepositoryService } from "../application/repository-service";

// Re-export types for use in presentation layer
export type { IndexingStatus } from "@/lib/db/schema";
