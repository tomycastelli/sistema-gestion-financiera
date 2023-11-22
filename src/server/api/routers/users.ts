import { z } from "zod";
import { getAllPermissions } from "~/lib/getAllPermisions";
import { PermissionSchema } from "~/lib/permissionsTypes";
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
  getWhitelist: protectedProcedure.query(async ({ ctx }) => {
    const permissions = await getAllPermissions(
      ctx.redis,
      ctx.session,
      ctx.db,
      {},
    );

    const hasPermissions = permissions?.find(
      (permission) =>
        permission.name === "ADMIN" ||
        permission.name === "USERS_WHITELIST_VISUALIZE",
    );

    if (hasPermissions) {
      const response = await ctx.db.emailWhitelist.findMany();

      return response;
    } else {
      return [];
    }
  }),
  addToWhitelist: protectedProcedure
    .input(z.object({ email: z.string() }))
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
          permission.name === "USERS_WHITELIST_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.emailWhitelist.create({
          data: {
            email: input.email,
          },
        });

        return response;
      } else {
        return [];
      }
    }),
  removeFromWhiteList: protectedProcedure
    .input(z.object({ email: z.string() }))
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
          permission.name === "USERS_WHITELIST_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.emailWhitelist.delete({
          where: {
            email: input.email,
          },
        });

        return response;
      } else {
        return [];
      }
    }),
  editWhitelist: protectedProcedure
    .input(z.object({ oldEmail: z.string(), newEmail: z.string() }))
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
          permission.name === "USERS_WHITELIST_MANAGE",
      );

      if (hasPermissions) {
        const response = await ctx.db.emailWhitelist.update({
          where: {
            email: input.oldEmail,
          },
          data: {
            email: input.newEmail,
          },
        });

        return response;
      } else {
        return [];
      }
    }),
  addManyToRole: protectedProcedure
    .input(z.object({ id: z.array(z.string()), roleId: z.number().int() }))
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

        const pipeline = ctx.redis.pipeline();

        input.id.forEach((item) => pipeline.del(`user_permissions:${item}`));

        pipeline
          .exec()
          .then((results) => {
            console.log("Keys deleted:", results);
          })
          .catch((error) => {
            console.error("Error deleting keys:", error);
          })
          .finally(() => {
            // Don't forget to close the connection
            void ctx.redis.quit();
          });

        return response;
      } else {
        return [];
      }
    }),
  deleteManyFromRole: protectedProcedure
    .input(z.object({ id: z.array(z.string()) }))
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

        const pipeline = ctx.redis.pipeline();

        input.id.forEach((item) => pipeline.del(`user_permissions:${item}`));

        pipeline
          .exec()
          .then((results) => {
            console.log("Keys deleted:", results);
          })
          .catch((error) => {
            console.error("Error deleting keys:", error);
          })
          .finally(() => {
            // Don't forget to close the connection
            void ctx.redis.quit();
          });

        return response;
      } else {
        return [];
      }
    }),
  getAllPermissions: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const response = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        input,
      );

      return response;
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
          permission.name === "USERS_PERMISSIONS_VISUALIZE",
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

        return permissions as z.infer<typeof PermissionSchema>;
      } else {
        return [];
      }
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
});
