import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PermissionSchema } from "~/lib/permissionsTypes";
import { deletePattern, getAllPermissions } from "~/lib/trpcFunctions";
import { entities, user } from "~/server/db/schema";
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
      const response = await ctx.db.transaction(async (transaction) => {
        const [userUpdate] = await transaction
          .update(user)
          .set({
            name: input.name,
          })
          .where(eq(user.id, input.userId))
          .returning();

        const [entityUpdate] = await transaction
          .update(entities)
          .set({
            name: input.name,
          })
          .where(eq(entities.name, input.oldName))
          .returning();

        return { userUpdate, entityUpdate };
      });

      if (response) {
        await deletePattern(ctx.redis, "entities|*");
      }
      return response;
    }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.query.user.findMany({
      with: {
        role: true,
      },
    });
    return response;
  }),
  getAllPermissions: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return [];
    }
    const response = getAllPermissions(ctx.redis, ctx.user, ctx.db);
    return response;
  }),
  getUserPermissions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_VISUALIZE" ||
          permission.name.startsWith("USERS_PERMISSIONS_MANAGE"),
      );

      if (hasPermissions) {
        const [response] = await ctx.db
          .select({ permissions: user.permissions })
          .from(user)
          .where(eq(user.id, input.id));

        if (!response) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `The user with id: ${input.id} does not exist`,
          });
        }

        return response.permissions as z.infer<typeof PermissionSchema> | null;
      } else {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "El usuario no tiene los permisos suficientes",
        });
      }
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const response = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.id),
        with: {
          role: true,
        },
      });

      return response;
    }),
  updatePermissions: protectedProcedure
    .input(z.object({ id: z.string(), permissions: PermissionSchema }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_MANAGE",
      );

      if (hasPermissions) {
        const [response] = await ctx.db
          .update(user)
          .set({
            permissions: input.permissions,
          })
          .where(eq(user.id, input.id))
          .returning();

        await ctx.redis.del(`user_permissions|${input.id}`);
        await deletePattern(ctx.redis, "entities|*");

        return response;
      } else {
        return null;
      }
    }),
  removePermissions: protectedProcedure
    .input(z.object({ id: z.string(), permissionNames: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_PERMISSIONS_MANAGE",
      );

      if (hasPermissions) {
        // @ts-ignore
        const permissionsData: z.infer<typeof PermissionSchema> = await ctx.db
          .select({ permissions: user.permissions })
          .from(user)
          .where(eq(user.id, input.id));

        const newPermissions = permissionsData.filter(
          (permission) => !input.permissionNames.includes(permission.name),
        );

        const [response] = await ctx.db
          .update(user)
          .set({
            permissions: newPermissions,
          })
          .where(eq(user.id, input.id))
          .returning();

        await ctx.redis.del(`user_permissions|${input.id}`);
        await deletePattern(ctx.redis, "entities|*");

        return response;
      } else {
        return null;
      }
    }),
  addUserToRole: protectedProcedure
    .input(z.object({ userId: z.string(), roleId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const [response] = await ctx.db
          .update(user)
          .set({
            roleId: input.roleId,
          })
          .where(eq(user.id, input.userId))
          .returning();

        await ctx.redis.del(`user_permissions|${input.userId}`);
        await deletePattern(ctx.redis, "entities|*");

        return response;
      } else {
        return null;
      }
    }),
  removeUserFromRole: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);

      const hasPermissions = permissions?.find(
        (permission) =>
          permission.name === "ADMIN" ||
          permission.name === "USERS_ROLES_MANAGE",
      );

      if (hasPermissions) {
        const [response] = await ctx.db
          .update(user)
          .set({
            roleId: null,
          })
          .where(eq(user.id, input.id))
          .returning();

        await ctx.redis.del(`user_permissions|${input.id}`);
        await deletePattern(ctx.redis, "entities|*");

        return response;
      } else {
        return null;
      }
    }),
});
