import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string(),
    DYNAMODB_TABLE: z.string(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),

    REDIS_URL: z.string(),

    AZURE_AD_CLIENT_ID: z.string(),
    AZURE_AD_CLIENT_SECRET: z.string(),
    AZURE_AD_TENANT_ID: z.string(),

    S3_PUBLIC_KEY: z.string(),
    S3_SECRET_KEY: z.string(),

    LAMBDA_API_ENDPOINT: z.string(),
    LAMBDA_API_KEY: z.string(),

    VERCEL_URL: z.string().optional(),

    CHAT_URL: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_MAIN_NAME: z.string(),
    NEXT_PUBLIC_MAIN_URL: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
    NEXT_PUBLIC_MAIN_NAME: process.env.NEXT_PUBLIC_MAIN_NAME,
    NEXT_PUBLIC_MAIN_URL: process.env.NEXT_PUBLIC_MAIN_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
    S3_PUBLIC_KEY: process.env.S3_PUBLIC_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    LAMBDA_API_ENDPOINT: process.env.LAMBDA_API_ENDPOINT,
    LAMBDA_API_KEY: process.env.LAMBDA_API_KEY,
    CHAT_URL: process.env.CHAT_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
