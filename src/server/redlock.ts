import { Redis } from "ioredis";
import Redlock from "redlock";
import { env } from "~/env.mjs";

const getRedisUrl = () => {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }

  throw new Error("REDIS_URL is not defined");
};

const redis = new Redis(getRedisUrl(), {
  enableAutoPipelining: true,
  maxRetriesPerRequest: 10,
  lazyConnect: true,
  keepAlive: 60000,
  connectTimeout: 15000,
  commandTimeout: 12000,
  enableReadyCheck: true,
});

export const redlock = new Redlock([redis], {
  // Clock drift factor - how much clock drift to account for
  driftFactor: 0.01,

  retryCount: 200,
  retryDelay: 500,
  retryJitter: 200,

  automaticExtensionThreshold: 3000, // Extend lock 3 second before expiry
});
