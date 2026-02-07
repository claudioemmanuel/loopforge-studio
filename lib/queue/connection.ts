import type { ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

/** Redis single-node connection options */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
  maxRetriesPerRequest: null;
}

// Parse Redis URL into connection options
function parseRedisUrl(url: string): RedisConnectionOptions {
  const parsedUrl = new URL(url);
  const dbPath = parsedUrl.pathname.replace("/", "");
  const parsedDb = dbPath ? parseInt(dbPath, 10) : NaN;

  return {
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port || "6379", 10),
    password: parsedUrl.password || undefined,
    username: parsedUrl.username || undefined,
    db: Number.isNaN(parsedDb) ? undefined : parsedDb,
    maxRetriesPerRequest: null,
  };
}

export const connectionOptions: RedisConnectionOptions =
  parseRedisUrl(redisUrl);

export const createConnectionOptions = (): ConnectionOptions => {
  return parseRedisUrl(redisUrl);
};

// Singleton Redis instance for DDD services
let redisInstance: Redis | null = null;

/**
 * Get shared Redis client for DDD services
 *
 * Creates a singleton Redis connection that can be reused across
 * application services (TaskService, ExecutionService, etc.)
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(connectionOptions);
  }
  return redisInstance;
}
