import Redis from "ioredis";
import { env } from "~/env.mjs";

const getRedisUrl = () => {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }

  throw new Error("UPSTASH_URL is not defined");
};

export const redis = new Redis(getRedisUrl());
