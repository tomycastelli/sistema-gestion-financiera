import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import {
  getAllEntities,
  getAllPermissions,
  getAllTags,
} from "~/lib/trpcFunctions";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const entitiesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const entities = await getAllEntities(ctx.redis, ctx.db);

    return entities;
  }),

  getFiltered: protectedProcedure.query(async ({ ctx }) => {
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
          (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
        )
      ) {
        return true;
      } else if (
        userPermissions?.find(
          (p) =>
            p.name === "ACCOUNTS_VISUALIZE_SOME" &&
            (p.entitiesIds?.includes(entity.id) ||
              getAllChildrenTags(p.entitiesTags, tags).includes(
                entity.tag.name,
              )),
        )
      ) {
        return true;
      }
    });

    return filteredEntities;
  }),

  addOne: publicProcedure
    .input(
      z.object({
        name: z.string(),
        tag: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const insertResponse = await ctx.db.entities.create({
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
            entityId: insertResponse.id,
          },
        });
      }

      await ctx.redis.del("cached_entities");
      return { message: "Entity added to database", data: insertResponse };
    }),
  deleteOne: protectedProcedure
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
        const deleteResponse = await ctx.db.entities.delete({
          where: {
            id: input.entityId,
          },
        });

        await ctx.redis.del("cached_entities");

        return deleteResponse;
      } else {
        throw new TRPCError({
          message: `La entidad tiene aunque sea una transacción (${transaction.id}) relacionada`,
          code: "CONFLICT",
        });
      }
    }),
  updateOne: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string(),
        tag: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updatedEntity = await ctx.db.entities.update({
        where: {
          id: input.id,
        },
        data: {
          name: input.name,
          tagName: input.tag,
        },
      });

      await ctx.redis.del("cached_entities");

      return updatedEntity;
    }),
});
