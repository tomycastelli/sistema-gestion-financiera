import { createTRPCRouter } from "~/server/api/trpc";
import { editingOperationsRouter } from "./routers/editingOperations";
import { entitiesRouter } from "./routers/entities";
import { exchangeRatesRouter } from "./routers/exchangeRates";
import { filesRouter } from "./routers/files";
import { globalSettingsRouter } from "./routers/globalSettings";
import { logsRouter } from "./routers/logs";
import { messagesRouter } from "./routers/messages";
import { movementsRouter } from "./routers/movements";
import { notificationsRouter } from "./routers/notifications";
import { operationsRouter } from "./routers/operations";
import { requestsRouter } from "./routers/requests";
import { rolesRouter } from "./routers/roles";
import { shareableLinksRouter } from "./routers/shareableLinks";
import { tagsRouter } from "./routers/tags";
import { userPreferencesRouter } from "./routers/userPreferences";
import { usersRouter } from "./routers/users";

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
  notifications: notificationsRouter,
  shareableLinks: shareableLinksRouter,
  users: usersRouter,
  roles: rolesRouter,
  logs: logsRouter,
  requests: requestsRouter,
  files: filesRouter,
  userPreferences: userPreferencesRouter,
  messages: messagesRouter,
  globalSettings: globalSettingsRouter,
  exchangeRates: exchangeRatesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
