import { z } from "zod";
import { getAllTags } from "~/lib/trpcFunctions";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const tagsRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const tags = await getAllTags(ctx.redis, ctx.db);
    return tags;
  }),
  addOne: protectedProcedure
    .input(z.object({ name: z.string(), parent: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.tag.create({
        data: {
          name: input.name,
          parent: input.parent,
        },
      });

      if (response) {
        await ctx.redis.del("tags");
      }
      return response;
    }),
  removeOne: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.tag.delete({
        where: {
          name: input.name,
        },
      });

      if (response) {
        await ctx.redis.del("tags");
      }

      return response;
    }),
});
