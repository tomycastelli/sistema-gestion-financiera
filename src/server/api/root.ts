import { createTRPCRouter } from "~/server/api/trpc";
import { entitiesRouter } from "./routers/entities";
import { operationsRouter } from "./routers/operations";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  entities: entitiesRouter,
  operations: operationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
