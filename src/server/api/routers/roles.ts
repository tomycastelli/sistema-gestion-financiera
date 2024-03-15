import { z } from "zod";
import { PermissionSchema } from "~/lib/permissionsTypes";
import { getAllPermissions } from "~/lib/trpcFunctions";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";

export const rolesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

    const hasPermissions = permissions?.find(
      (permission) =>
        permission.name === "ADMIN" ||
        permission.name === "USERS_ROLES_VISUALIZE" ||
        permission.name === "USERS_ROLES_MANAGE",
    );

    const hasSpecificRoles = permissions?.find(
      (p) => p.name === "USERS_ROLES_MANAGE_SOME",
    )?.entitiesTags;

    if (hasSpecificRoles && !hasPermissions) {
      const response = await ctx.db.role.findMany({
        where: { name: { in: hasSpecificRoles } },
        include: {
          users: true,
        },
      });

      return response;
    }
    if (hasPermissions) {
      const response = await ctx.db.role.findMany({
        include: {
          users: true,
        },
      });

      return response;
    } else {
      return null;
    }
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_VISUALIZE" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.role.findUnique({
          where: {
            id: input.id,
          },
          include: {
            users: true,
          },
        });

        return response;
      } else {
        return null;
      }
    }),
  addOne: protectedLoggedProcedure
    .input(
      z.object({
        name: z.string(),
        permissions: PermissionSchema,
        color: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.role.create({
          data: {
            name: input.name,
            permissions: input.permissions,
            color: input.color,
          },
        });

        return response;
      } else {
        return null;
      }
    }),
  deleteOne: protectedLoggedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.role.delete({
          where: {
            id: input.id,
          },
          include: {
            users: true,
          },
        });

        const pipeline = ctx.redis.pipeline();
        response.users.forEach((user) => {
          pipeline.del(`user_permissions:${user.id}`);
        });

        await pipeline.exec();

        return response;
      } else {
        return null;
      }
    }),
  updateOne: protectedLoggedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string(),
        permissions: PermissionSchema,
        color: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name.startsWith("USERS_PERMISSIONS_MANAGE"),
      );

      if (hasPermissions) {
        const response = await ctx.db.role.update({
          where: {
            id: input.id,
          },
          data: {
            name: input.name,
            permissions: input.permissions,
            color: input.color,
          },
          include: {
            users: true,
          },
        });

        const pipeline = ctx.redis.pipeline();
        response.users.forEach((user) => {
          pipeline.del(`user_permissions:${user.id}`);
        });

        await pipeline.exec();

        return response;
      } else {
        return null;
      }
    }),
});
