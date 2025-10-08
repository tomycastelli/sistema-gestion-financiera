import { TRPCError } from "@trpc/server";
import type Redlock from "redlock";
import logtail from "~/lib/logger";

export interface LockOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  operationName?: string;
}

/**
 * Acquire a lock with enhanced retry logic and better error handling
 */
export const acquireLockWithRetries = async (
  redlock: Redlock,
  resources: string[],
  duration: number,
  options: LockOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  const {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 10000,
    operationName = "unknown",
  } = options;

  const startTime = Date.now();

  let lastError: Error | null = null;
  let currentDelay = baseDelay;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      void logtail.info(`Attempting to acquire lock`, {
        operationName,
        attempt: attempt + 1,
        resources,
        duration,
      });

      const lock = await redlock.acquire(resources, duration);

      void logtail.info(`Lock acquired successfully`, {
        operationName,
        attempt: attempt + 1,
        duration: Date.now() - startTime,
        resources,
      });

      return lock;
    } catch (error) {
      lastError = error as Error;

      void logtail.warn(`Lock acquisition failed`, {
        operationName,
        attempt: attempt + 1,
        error: (error as Error).message,
        resources,
        willRetry: attempt < maxRetries - 1,
      });

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.1 * currentDelay;
        const delay = Math.min(currentDelay + jitter, maxDelay);

        await new Promise((resolve) => setTimeout(resolve, delay));
        currentDelay = Math.min(currentDelay * 1.5, maxDelay);
      }
    }
  }

  // All retries failed
  void logtail.error(`Failed to acquire lock after ${maxRetries} attempts`, {
    operationName,
    totalDuration: Date.now() - startTime,
    resources,
    lastError: lastError?.message,
  });

  throw new TRPCError({
    code: "TIMEOUT",
    message: `Unable to acquire lock for operation: ${operationName}. Please try again later.`,
  });
};

/**
 * Execute a function with a lock, automatically handling acquisition and release
 */
export const withLock = async <T>(
  redlock: Redlock,
  resources: string[],
  duration: number,
  operation: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> => {
  const lock = await acquireLockWithRetries(
    redlock,
    resources,
    duration,
    options,
  );

  try {
    return await operation();
  } finally {
    try {
      await lock.release();
      void logtail.info(`Lock released successfully`, {
        operationName: options.operationName,
        resources,
      });
    } catch (error) {
      void logtail.error(`Failed to release lock`, {
        operationName: options.operationName,
        resources,
        error: (error as Error).message,
      });
      throw error;
    }
  }
};
