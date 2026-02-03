/**
 * Repository Context API (Public Interface)
 */

import { getRedis } from "@/lib/queue";
import { RepositoryService } from "../application/repository-service";

export function getRepositoryService(): RepositoryService {
  const redis = getRedis();
  return new RepositoryService(redis);
}

export { RepositoryService } from "../application/repository-service";
