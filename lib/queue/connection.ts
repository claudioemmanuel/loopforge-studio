import type { ConnectionOptions } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

/** Redis single-node connection options */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  username?: string;
  maxRetriesPerRequest: null;
}

// Parse Redis URL into connection options
function parseRedisUrl(url: string): RedisConnectionOptions {
  const parsedUrl = new URL(url);
  return {
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port || "6379", 10),
    password: parsedUrl.password || undefined,
    username: parsedUrl.username || undefined,
    maxRetriesPerRequest: null,
  };
}

export const connectionOptions: RedisConnectionOptions = parseRedisUrl(redisUrl);

export const createConnectionOptions = (): ConnectionOptions => {
  return parseRedisUrl(redisUrl);
};
