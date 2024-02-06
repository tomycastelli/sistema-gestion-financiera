import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PermissionSchema, mergePermissions } from "~/lib/permissionsTypes";
import { getAllPermissions } from "~/lib/trpcFunctions";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const usersRouter = createTRPCRouter({
  changeName: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().max(25),
        oldName: z.string().max(25),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userUpdate = ctx.db.user.update({
        where: {
          id: input.userId,
        },
        data: {
          name: input.name,
        },
      });

      const userEntityUpdate = ctx.db.entities.update({
        where: {
          name: input.oldName,
        },
        data: {
          name: input.name,
        },
      });

      const response = await ctx.db.$transaction([
        userUpdate,
        userEntityUpdate,
      ]);

      if (response) {
        await ctx.redis.del("cached_entities");
      }
      return response[0];
    }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.user.findMany({ include: { role: true } });
    return response;
  }),
  getAllPermissions: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.session) {
        return [];
      }
      const cachedResponseString = await ctx.redis.get(
        `user_permissions:${ctx.session.user.id}`,
      );
      if (cachedResponseString) {
        const cachedResponse: z.infer<typeof PermissionSchema> =
          JSON.parse(cachedResponseString);
        return cachedResponse;
      }

      const user = await ctx.db.user.findUnique({
        where: {
          id: input.userId ? input.userId : ctx.session.user.id,
        },
      });
      if (ctx.session.user.roleId) {
        const role = await ctx.db.role.findUnique({
          where: {
            id: ctx.session.user.roleId,
          },
        });

        if (role?.permissions && user?.permissions) {
          // @ts-ignore
          const merged = mergePermissions(role.permissions, user.permissions);

          await ctx.redis.set(
            `user_permissions:${ctx.session.user.id}`,
            JSON.stringify(merged),
            "EX",
            300,
          );

          return merged as z.infer<typeof PermissionSchema> | null;
        }
        if (role?.permissions) {
          await ctx.redis.set(
            `user_permissions:${ctx.session.user.id}`,
            JSON.stringify(role.permissions),
            "EX",
            300,
          );

          return role.permissions as z.infer<typeof PermissionSchema> | null;
        }
      }
      if (user?.permissions) {
        await ctx.redis.set(
          `user_permissions:${ctx.session.user.id}`,
          JSON.stringify(user.permissions),
          "EX",
          300,
        );

        return user.permissions as z.infer<typeof PermissionSchema> | null;
      }
    }),
  getUserPermissions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        {},
      );

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_VISUALIZE" ||
          permission.name.startsWith("USERS_PERMISSIONS_MANAGE"),
      );

      if (hasPermissions) {
        // @ts-ignore
        const { permissions } = await ctx.db.user.findUnique({
          where: {
            id: input.id,
          },
          select: {
            permissions: true,
          },
        });

        return permissions as z.infer<typeof PermissionSchema> | null;
      } else {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Usuario sin el siguiente permiso: USERS_PERMISSIONS_VISUALIZE",
        });
      }
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const response = ctx.db.user.findUnique({
        where: {
          id: input.id,
        },
        include: {
          role: true,
        },
      });

      return response;
    }),
  updatePermissions: protectedProcedure
    .input(z.object({ id: z.string(), permissions: PermissionSchema }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        {},
      );

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.user.update({
          where: {
            id: input.id,
          },
          data: {
            permissions: input.permissions,
          },
        });

        await ctx.redis.del(`user_permissions:${input.id}`);
        return response;
      } else {
        return null;
      }
    }),
  removePermissions: protectedProcedure
    .input(z.object({ id: z.string(), permissionNames: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        {},
      );

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_MANAGE",
      );

      if (hasPermissions) {
        // @ts-ignore
        const permissionsData: z.infer<typeof PermissionSchema> =
          await ctx.db.user.findUnique({
            where: {
              id: input.id,
            },
            select: {
              permissions: true,
            },
          });

        const newPermissions = permissionsData.filter(
          (permission) => !input.permissionNames.includes(permission.name),
        );

        const response = await ctx.db.user.update({
          where: {
            id: input.id,
          },
          data: {
            permissions: newPermissions,
          },
        });

        await ctx.redis.del(`user_permissions:${input.id}`);

        return response;
      } else {
        return null;
      }
    }),
  addUserToRole: protectedProcedure
    .input(z.object({ userId: z.string(), roleId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        {},
      );

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.user.update({
          where: {
            id: input.userId,
          },
          data: {
            roleId: input.roleId,
          },
        });

        await ctx.redis.del(`user_permissions:${input.userId}`);

        return response;
      } else {
        return null;
      }
    }),
  removeUserFromRole: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        {},
      );

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.user.update({
          where: {
            id: input.id,
          },
          data: {
            roleId: null,
          },
        });

        await ctx.redis.del(`user_permissions:${input.id}`);

        return response;
      } else {
        return null;
      }
    }),
});
