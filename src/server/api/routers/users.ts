import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { mergePermissions, PermissionSchema } from "~/lib/permissionsTypes";
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
    const response = await ctx.db.user.findMany();
    return response;
  }),
  isWhitelisted: publicProcedure
    .input(z.object({ email: z.string() }))
    .query(async ({ ctx, input }) => {
      const response = await ctx.db.emailWhitelist.findUnique({
        where: {
          email: input.email,
        },
      });

      if (response) {
        return true;
      } else {
        return false;
      }
    }),
  addManyToRole: protectedProcedure
    .input(z.object({ id: z.array(z.string()), roleId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const hasPermissions = ctx.session.user.permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.user.updateMany({
          where: {
            id: {
              in: input.id,
            },
          },
          data: {
            roleId: input.roleId,
          },
        });

        return response;
      } else {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuario no posee permisos",
        });
      }
    }),
  deleteManyFromRole: protectedProcedure
    .input(z.object({ id: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const hasPermissions = ctx.session.user.permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.user.updateMany({
          where: {
            id: {
              in: input.id,
            },
          },
          data: {
            roleId: null,
          },
        });

        return response;
      } else {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuario no posee permisos",
        });
      }
    }),
  getAllPermissions: protectedProcedure.query(async ({ ctx }) => {
    const cachedResponseString = await ctx.redis.get(
      `user_permissions:${ctx.session.user.id}`,
    );
    if (cachedResponseString) {
      const cachedResponse: z.infer<typeof PermissionSchema> =
        JSON.parse(cachedResponseString);
      return cachedResponse;
    }

    // @ts-ignore
    const { permissions } = await ctx.db.user.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      select: {
        permissions: true,
      },
    });
    if (ctx.session.user.roleId) {
      // @ts-ignore
      const { rolePermissions } = await ctx.db.role.findUnique({
        where: {
          id: ctx.session.user.roleId,
        },
        select: {
          permissions: true,
        },
      });

      if (rolePermissions && permissions) {
        const merged = mergePermissions(rolePermissions, permissions);

        await ctx.redis.set(
          `user_permissions:${ctx.session.user.id}`,
          JSON.stringify(merged),
          "EX",
          300,
        );

        return merged as z.infer<typeof PermissionSchema> | null;
      }
      if (rolePermissions && !permissions) {
        await ctx.redis.set(
          `user_permissions:${ctx.session.user.id}`,
          JSON.stringify(rolePermissions),
          "EX",
          300,
        );

        return rolePermissions as z.infer<typeof PermissionSchema> | null;
      }
    }
    if (permissions) {
      await ctx.redis.set(
        `user_permissions:${ctx.session.user.id}`,
        JSON.stringify(permissions),
        "EX",
        300,
      );

      return permissions as z.infer<typeof PermissionSchema> | null;
    }
  }),
  getUserPermissions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // @ts-ignore
      const { permissions } = await ctx.db.user.findUnique({
        where: {
          id: input.id,
        },
        select: {
          permissions: true,
        },
      });

      return permissions as z.infer<typeof PermissionSchema>;
    }),
  updatePermissions: protectedProcedure
    .input(z.object({ id: z.string(), permissions: PermissionSchema }))
    .mutation(async ({ ctx, input }) => {
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
    }),
  removePermissions: protectedProcedure
    .input(z.object({ id: z.string(), permissionNames: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      // @ts-ignore
      const permissions: z.infer<typeof PermissionSchema> =
        await ctx.db.user.findUnique({
          where: {
            id: input.id,
          },
          select: {
            permissions: true,
          },
        });

      const newPermissions = permissions.filter(
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
    }),
});
