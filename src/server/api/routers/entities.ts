import type { Entities } from "@prisma/client";
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
      const parsedEntities = JSON.parse(cachedEntities) as Entities[];

      return parsedEntities;
    }

    const entities = await ctx.db.entities.findMany();

    console.log("Entities queried from database");

    if (!entities)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Entities returned empty from database",
      });

    await ctx.redis.set("cached_entities", JSON.stringify(entities), "EX", 120);

    return entities;
  }),
  addOne: publicProcedure
    .input(z.object({ name: z.string(), tag: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insertResponse = await ctx.db.entities.create({
        data: {
          name: input.name,
          tag: input.tag,
        },
      });
      return { message: "User added to entities table", data: insertResponse };
    }),
});
