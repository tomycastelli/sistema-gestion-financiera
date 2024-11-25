import { z } from "zod";

export const PermissionsNames = [
  "ADMIN",
  "EXCHANGERATES_CREATE",
  "OPERATIONS_CREATE",
  "OPERATIONS_CREATE_SOME",
  "OPERATIONS_VISUALIZE",
  "OPERATIONS_VISUALIZE_SOME",
  "TRANSACTIONS_UPDATE",
  "TRANSACTIONS_UPDATE_SOME",
  "TRANSACTIONS_VALIDATE",
  "TRANSACTIONS_VALIDATE_SOME",
  "TRANSACTIONS_DELETE",
  "TRANSACTIONS_DELETE_SOME",
  "TRANSACTIONS_CANCEL",
  "TRANSACTIONS_CANCEL_SOME",
  "ACCOUNTS_VISUALIZE",
  "ACCOUNTS_VISUALIZE_SOME",
  "ENTITIES_MANAGE",
  "ENTITIES_MANAGE_SOME",
  "USERS_PERMISSIONS_VISUALIZE",
  "USERS_PERMISSIONS_MANAGE",
  "USERS_PERMISSIONS_MANAGE_SOME",
  "USERS_PERMISSIONS_MANAGE_OPERATIONS",
  "USERS_PERMISSIONS_MANAGE_TRANSACTIONS",
  "USERS_PERMISSIONS_MANAGE_ACCOUNTS",
  "USERS_PERMISSIONS_MANAGE_ENTITIES",
  "USERS_ROLES_VISUALIZE",
  "USERS_ROLES_MANAGE",
  "USERS_ROLES_MANAGE_SOME",
  "LOGS_VISUALIZE",
] as const;

export const PermissionSchema = z.array(
  z.object({
    name: z.enum(PermissionsNames),
    entitiesIds: z.array(z.number().int()).optional(),
    entitiesTags: z.array(z.string()).optional(),
  }),
);

export const mergePermissions = (
  permissions1: z.infer<typeof PermissionSchema>,
  permissions2: z.infer<typeof PermissionSchema>,
) => {
  const mergedPermissions: typeof permissions1 = [];

  const addToMergedPermissions = (
    permission: (typeof permissions1)[number],
  ) => {
    const existingPermission = mergedPermissions.find(
      (p) => p.name === permission.name,
    );

    if (existingPermission) {
      // Merge entitiesIds and entitiesTags if both have _SOME in their names
      if (
        permission.name.endsWith("_SOME") &&
        existingPermission.name.endsWith("_SOME")
      ) {
        existingPermission.entitiesIds = [
          ...(existingPermission.entitiesIds ?? []),
          ...(permission.entitiesIds ?? []),
        ];
        existingPermission.entitiesTags = [
          ...(existingPermission.entitiesTags ?? []),
          ...(permission.entitiesTags ?? []),
        ];
      }
    } else {
      // If the permission doesn't exist in the merged array, add it
      mergedPermissions.push(permission);
    }
  };

  // Add permissions from the first array
  permissions1.forEach(addToMergedPermissions);

  // Add permissions from the second array
  permissions2.forEach(addToMergedPermissions);

  return mergedPermissions;
};

const permissionsDataSchema = z.array(
  z.object({
    name: z.enum(PermissionsNames),
    label: z.string(),
    description: z.string(),
  }),
);

export const permissionsData: z.infer<typeof permissionsDataSchema> = [
  {
    name: "ADMIN",
    label: "Administrador",
    description: "Todos los permisos",
  },
  {
    name: "EXCHANGERATES_CREATE",
    label: "Cargar y modificar cotizaciones",
    description: "Cargar y modificar las cotizaciones de divisas",
  },
  {
    name: "OPERATIONS_CREATE",
    label: "Crear operaciones",
    description: "Crear todo tipo de operaciones",
  },
  {
    name: "OPERATIONS_CREATE_SOME",
    label: "Crear algunas operaciones",
    description: "Crear operaciones según la entidad",
  },
  {
    name: "OPERATIONS_VISUALIZE",
    label: "Visualizar operaciones",
    description: "Visualizar todas las operaciones",
  },
  {
    name: "OPERATIONS_VISUALIZE_SOME",
    label: "Visualizar algunas operaciones",
    description: "Visualizar operaciones según la entidad",
  },
  {
    name: "TRANSACTIONS_UPDATE",
    label: "Actualizar transacciones",
    description: "Actualizar todas las transacciones",
  },
  {
    name: "TRANSACTIONS_UPDATE_SOME",
    label: "Actualizar algunas transacciones",
    description: "Actualizar transacciones según la entidad",
  },
  {
    name: "TRANSACTIONS_VALIDATE",
    label: "Validar transacciones",
    description: "Validar todas las transacciones",
  },
  {
    name: "TRANSACTIONS_VALIDATE_SOME",
    label: "Validar algunas transacciones",
    description: "Validar transacciones según la entidad",
  },
  {
    name: "TRANSACTIONS_DELETE",
    label: "Eliminar transacciones",
    description: "Eliminar todas las transacciones",
  },
  {
    name: "TRANSACTIONS_DELETE_SOME",
    label: "Eliminar algunas transacciones",
    description: "Eliminar transacciones según la entidad",
  },
  {
    name: "TRANSACTIONS_CANCEL",
    label: "Cancelar transacciones",
    description: "Cancelar todas las transacciones",
  },
  {
    name: "TRANSACTIONS_CANCEL_SOME",
    label: "Cancelar algunas transacciones",
    description: "Cancelar transacciones según la entidad",
  },
  {
    name: "ACCOUNTS_VISUALIZE",
    label: "Visualizar cuentas",
    description: "Visualizar todas las cuentas",
  },
  {
    name: "ACCOUNTS_VISUALIZE_SOME",
    label: "Visualizar algunas cuentas",
    description: "Visualizar cuentas segun la entidad",
  },
  {
    name: "ENTITIES_MANAGE",
    label: "Manejar entidades",
    description: "Crear, cambiar y eliminar entidades",
  },
  {
    name: "ENTITIES_MANAGE_SOME",
    label: "Manejar algunas entidades",
    description: "Crear, cambiar y eliminar algunas entidades",
  },
  {
    name: "USERS_PERMISSIONS_VISUALIZE",
    label: "Visualizar los permisos de los usuarios",
    description: "Visualizar los permisos de los usuarios",
  },
  {
    name: "USERS_PERMISSIONS_MANAGE",
    label: "Manejar los permisos de los usuarios",
    description: "Manejar los permisos de los usuarios",
  },
  {
    name: "USERS_PERMISSIONS_MANAGE_SOME",
    label: "Manejar los permisos de algunos usuarios",
    description: "Manejar los permisos de algunos usuarios",
  },
  {
    name: "USERS_PERMISSIONS_MANAGE_OPERATIONS",
    label: "Manejar los permisos de operaciones",
    description: "Manear los permisos relacionados a operaciones",
  },
  {
    name: "USERS_PERMISSIONS_MANAGE_TRANSACTIONS",
    label: "Manejar los permisos de transacciones",
    description: "Manejar los permisos relacionados a transacciones",
  },
  {
    name: "USERS_PERMISSIONS_MANAGE_ACCOUNTS",
    label: "Manejar los permisos de cuentas",
    description: "Manejar los permisos relacionados a cuentas",
  },
  {
    name: "USERS_PERMISSIONS_MANAGE_ENTITIES",
    label: "Manejar los permisos de entidades",
    description: "Manejar los permisos relacionados a entidades",
  },
  {
    name: "USERS_ROLES_VISUALIZE",
    label: "Visualizar roles",
    description: "Visualizar roles",
  },
  {
    name: "USERS_ROLES_MANAGE",
    label: "Manejar los roles",
    description: "Manejar los roles",
  },
  {
    name: "USERS_ROLES_MANAGE_SOME",
    label: "Manejar algunos roles",
    description: "Manejar algunos roles",
  },
  {
    name: "LOGS_VISUALIZE",
    label: "Visualizar los logs",
    description: "Visualizar los logs",
  },
];
