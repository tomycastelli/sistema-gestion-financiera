import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

// Increase timeout for long-running operations (e.g., large file exports)
// 300 seconds = 5 minutes
export const maxDuration = 300;

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError: ({ path, error, input, type, ctx }) => {
      console.error("❌ tRPC Error:", {
        path: path ?? "<no-path>",
        type,
        error: {
          code: error.code,
          message: error.message,
          cause: error.cause,
          stack: error.stack,
        },
        input,
        userId: ctx?.user?.id,
      });
    },
  });

export { handler as GET, handler as POST };
