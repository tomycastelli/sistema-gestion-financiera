import { z } from "zod";

const PermissionsNames = [
  "OPERATIONS_CREATE",
  "OPERATIONS_CREATE_SOME",
  "OPERATIONS_VISUALIZE",
  "OPERATIONS_VISUALIZE_SOME",
  "TRANSACTIONS_UPDATE",
  "TRANSACTIONS_UPDATE_SOME",
  "TRANSACTIONS_VALIDATE",
  "TRANSACTIONS_VALIDATE_SOME",
  "ACCOUNTS_VISUALIZE",
  "ACCOUNTS_VISUALIZE_SOME",
  "ENTITIES_CREATE",
  "ENTITIES_UPDATE",
  "ENTITIES_DELETE",
] as const;

export const PermissionSchema = z.array(
  z.object({
    name: z.enum(PermissionsNames),
    entitiesIds: z.array(z.number().int()).optional(),
    entitiesTags: z.array(z.string()).optional(),
  }),
);
