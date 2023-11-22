import { z } from "zod";
import { getAllPermissions } from "~/lib/getAllPermisions";
import { PermissionSchema } from "~/lib/permissionsTypes";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const rolesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const permissions = await getAllPermissions(
      ctx.redis,
      ctx.session,
      ctx.db,
      {},
    );

    const hasPermissions = permissions?.find(
      (permission) =>
        permission.name === "ADMIN" ||
        permission.name === "USERS_ROLES_VISUALIZE",
    );

    if (hasPermissions) {
      const response = await ctx.db.role.findMany();

      return response;
    } else {
      return null;
    }
  }),
  addOne: protectedProcedure
    .input(z.object({ name: z.string(), permissions: PermissionSchema }))
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
        const response = await ctx.db.role.create({
          data: {
            name: input.name,
            permissions: input.permissions,
          },
        });

        return response;
      } else {
        return null;
      }
    }),
  deleteOne: protectedProcedure
    .input(z.object({ id: z.number().int() }))
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
        const response = await ctx.db.role.delete({
          where: {
            id: input.id,
          },
        });

        return response;
      } else {
        return null;
      }
    }),
  updateOne: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string(),
        permissions: PermissionSchema,
      }),
    )
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
        const response = await ctx.db.role.update({
          where: {
            id: input.id,
          },
          data: {
            name: input.name,
            permissions: input.permissions,
          },
        });

        return response;
      } else {
        return null;
      }
    }),
});
