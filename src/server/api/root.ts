import { createTRPCRouter } from "~/server/api/trpc";
import { editingOperationsRouter } from "./routers/editingOperations";
import { entitiesRouter } from "./routers/entities";
import { filesRouter } from "./routers/files";
import { logsRouter } from "./routers/logs";
import { movementsRouter } from "./routers/movements";
import { operationsRouter } from "./routers/operations";
import { requestsRouter } from "./routers/requests";
import { rolesRouter } from "./routers/roles";
import { shareableLinksRouter } from "./routers/shareableLinks";
import { tagsRouter } from "./routers/tags";
import { userPreferencesRouter } from "./routers/userPreferences";
import { usersRouter } from "./routers/users";
import { messagesRouter } from "./routers/messages";
import { globalSettingsRouter } from "./routers/globalSettings";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  entities: entitiesRouter,
  tags: tagsRouter,
  operations: operationsRouter,
  editingOperations: editingOperationsRouter,
  movements: movementsRouter,
  shareableLinks: shareableLinksRouter,
  users: usersRouter,
  roles: rolesRouter,
  logs: logsRouter,
  requests: requestsRouter,
  files: filesRouter,
  userPreferences: userPreferencesRouter,
  messages: messagesRouter,
  globalSettings: globalSettingsRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;
