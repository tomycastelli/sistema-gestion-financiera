import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import { PermissionsNames } from "~/lib/permissionsTypes";
import {
  getAllEntities,
  getAllPermissions,
  getAllTags,
  logIO,
} from "~/lib/trpcFunctions";

import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const entitiesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const entities = await getAllEntities(ctx.redis, ctx.db);

    return entities;
  }),

  getFiltered: protectedProcedure
    .input(z.object({ permissionName: z.enum(PermissionsNames) }))
    .query(async ({ ctx, input }) => {
      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        { userId: undefined },
      );
      const tags = await getAllTags(ctx.redis, ctx.db);
      const entities = await getAllEntities(ctx.redis, ctx.db);

      const filteredEntities = entities.filter((entity) => {
        if (
          userPermissions?.find(
            (p) => p.name === "ADMIN" || p.name === input.permissionName,
          )
        ) {
          return true;
        } else if (
          userPermissions?.find(
            (p) =>
              p.name === `${input.permissionName}_SOME` &&
              (p.entitiesIds?.includes(entity.id) ||
                getAllChildrenTags(p.entitiesTags, tags).includes(
                  entity.tag.name,
                )),
          )
        ) {
          return true;
        } else if (entity.name === ctx.session.user.name) {
          return true;
        }
      });

      return filteredEntities;
    }),

  addOne: protectedLoggedProcedure
    .input(
      z.object({
        name: z.string(),
        tag: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.entities.create({
        data: {
          name: input.name,
          tagName: input.tag,
        },
      });

      if (input.tag === "Usuario" && input.userId) {
        await ctx.db.user.update({
          where: {
            id: input.userId,
          },
          data: {
            entityId: response.id,
          },
        });
      }

      await logIO(
        ctx.dynamodb,
        ctx.session.user.id,
        "Añadir entidad",
        input,
        response,
      );

      await ctx.redis.del("cached_entities");
      return response;
    }),
  deleteOne: protectedLoggedProcedure
    .input(z.object({ entityId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transactions.findFirst({
        where: {
          OR: [
            { fromEntityId: input.entityId },
            { toEntityId: input.entityId },
          ],
        },
      });

      if (!transaction) {
        const response = await ctx.db.entities.delete({
          where: {
            id: input.entityId,
          },
        });

        await logIO(
          ctx.dynamodb,
          ctx.session.user.id,
          "Eliminar entidad",
          input,
          response,
        );

        await ctx.redis.del("cached_entities");

        return response;
      } else {
        throw new TRPCError({
          message: `La entidad tiene aunque sea una transacción (${transaction.id}) relacionada`,
          code: "CONFLICT",
        });
      }
    }),
  updateOne: protectedLoggedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string(),
        tag: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.entities.update({
        where: {
          id: input.id,
        },
        data: {
          name: input.name,
          tagName: input.tag,
        },
      });

      await logIO(
        ctx.dynamodb,
        ctx.session.user.id,
        "Actualizar entidad",
        input,
        response,
      );

      await ctx.redis.del("cached_entities");

      return response;
    }),
});
