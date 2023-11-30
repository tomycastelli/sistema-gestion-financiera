import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const entitiesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const cachedEntities: string | null = await ctx.redis.get(
      "cached_entities",
    );

    if (cachedEntities) {
      console.log("Entities queried from cache");
      const parsedEntities: typeof entities = JSON.parse(cachedEntities);

      return parsedEntities;
    }

    const entities = await ctx.db.entities.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
      },
    });

    console.log("Entities queried from database");

    if (!entities)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Entities returned empty from database",
      });

    await ctx.redis.set(
      "cached_entities",
      JSON.stringify(entities),
      "EX",
      "3600",
    );

    return entities;
  }),
  addOne: publicProcedure
    .input(z.object({ name: z.string(), tag: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insertResponse = await ctx.db.entities.create({
        data: {
          name: input.name,
          tagName: input.tag,
        },
      });

      await ctx.redis.del("cached_entities");
      return { message: "Entity added to database", data: insertResponse };
    }),
  deleteOne: protectedProcedure
    .input(z.object({ entityId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const deleteResponse = await ctx.db.entities.delete({
        where: {
          id: input.entityId,
        },
      });

      await ctx.redis.del("cached_entities");

      return deleteResponse;
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
