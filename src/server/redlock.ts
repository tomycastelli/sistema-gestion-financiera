import { Redis } from "ioredis";
import Redlock from "redlock";
import { env } from "~/env.mjs";

// Create Redis instances with optimized settings for long-running locks
const createRedisInstance = (url: string) => {
  return new Redis(url, {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 5,
    lazyConnect: true,
    keepAlive: 120000, // 2 minutes keepalive for long locks
    connectTimeout: 20000, // 20 seconds connection timeout
    commandTimeout: 15000, // 15 seconds command timeout
    enableReadyCheck: true,
    // Add connection resilience for long-running operations
    reconnectOnError: (err) => {
      return (
        err.message.includes("READONLY") || err.message.includes("ECONNRESET")
      );
    },
  });
};

// Create two Redis instances for proper redlock quorum
const redis1 = createRedisInstance(env.REDIS_URL);
const redis2 = createRedisInstance(env.REDIS_URL_TWO);

export const redlock = new Redlock([redis1, redis2], {
  // Clock drift factor - how much clock drift to account for
  driftFactor: 0.01,

  // Optimized retry settings for long-running locks
  retryCount: 100, // Reduced from 200 to prevent excessive retries
  retryDelay: 1000, // Increased base delay for better quorum chances
  retryJitter: 500, // Increased jitter for better distribution

  automaticExtensionThreshold: 10000, // Extend lock 10 seconds before expiry for long operations
});
