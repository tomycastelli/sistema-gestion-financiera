import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { PermissionSchema } from "~/lib/permissionsTypes";
import { getAllPermissions } from "~/lib/trpcFunctions";
import { role, user } from "~/server/db/schema";
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

    if (hasPermissions) {
      const response = await ctx.db.query.role.findMany({
        with: {
          users: true,
        },
      });
      return response;
    }

    const hasSpecificRoles = permissions?.find(
      (p) => p.name === "USERS_ROLES_MANAGE_SOME",
    )?.entitiesTags;


    if (hasSpecificRoles) {
      const response = await ctx.db.query.role.findMany({
        where: inArray(role.name, Array.from(hasSpecificRoles)),
        with: {
          users: true,
        },
      });

      return response;
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
        const response = await ctx.db.query.role.findFirst({
          where: eq(role.id, input.id),
          with: {
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
        const [response] = await ctx.db
          .insert(role)
          .values({
            name: input.name,
            permissions: input.permissions,
            color: input.color,
          })
          .returning();

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
        const users = await ctx.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.roleId, input.id));
        const [response] = await ctx.db
          .delete(role)
          .where(eq(role.id, input.id))
          .returning();

        const pipeline = ctx.redis.pipeline();
        users.forEach((user) => {
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
        const users = await ctx.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.roleId, input.id));

        const [response] = await ctx.db
          .update(role)
          .set({
            name: input.name,
            permissions: input.permissions,
            color: input.color,
          })
          .where(eq(role.id, input.id))
          .returning();

        const pipeline = ctx.redis.pipeline();
        users.forEach((user) => {
          pipeline.del(`user_permissions:${user.id}`);
        });

        await pipeline.exec();

        return response;
      } else {
        return null;
      }
    }),
});
