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
  driftFactor: 0.01,
  retryCount: 40,
  retryDelay: 500,
  retryJitter: 300,
});
