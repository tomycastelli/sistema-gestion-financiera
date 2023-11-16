import { createTRPCRouter } from "~/server/api/trpc";
import { editingOperationsRouter } from "./routers/editingOperations";
import { entitiesRouter } from "./routers/entities";
import { movementsRouter } from "./routers/movements";
import { operationsRouter } from "./routers/operations";
import { shareableLinksRouter } from "./routers/shareableLinks";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  entities: entitiesRouter,
  operations: operationsRouter,
  editingOperations: editingOperationsRouter,
  movements: movementsRouter,
  shareableLinks: shareableLinksRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
