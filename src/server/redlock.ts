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

  // Retry settings for lock acquisition - optimized for single Redis instance
  retryCount: 10,
  retryDelay: 2000,
  retryJitter: 100,

  // Automatic lock extension settings
  automaticExtensionThreshold: 1000, // Extend lock 1 second before expiry
});
