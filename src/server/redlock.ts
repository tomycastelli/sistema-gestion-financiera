import { Redis } from "ioredis";
import Redlock from "redlock";
import { env } from "~/env.mjs";

const getRedisUrl = () => {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }

  throw new Error("REDIS_URL is not defined");
};

const redis = new Redis(getRedisUrl(), { enableAutoPipelining: true });

export const redlock = new Redlock([redis], {
  // Clock drift factor - how much clock drift to account for
  driftFactor: 0.01,

  // Improved retry settings for better reliability with single Redis instance
  retryCount: 25, // Increased from 10 for more attempts
  retryDelay: 1000, // Reduced from 2000ms to 1000ms for faster retries
  retryJitter: 500, // Increased jitter from 100ms to 500ms for better distribution

  // Automatic lock extension settings
  automaticExtensionThreshold: 2000, // Extend lock 2 seconds before expiry (increased from 1000ms)
});
