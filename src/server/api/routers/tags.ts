import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import { getAllPermissions, getAllTags } from "~/lib/trpcFunctions";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const tagsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
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

      const newLog = new ctx.logs({
        name: "addOneTag",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: response,
      });

      await newLog.save();

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

      const newLog = new ctx.logs({
        name: "removeOneTag",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: response,
      });

      await newLog.save();

      return response;
    }),
  getFiltered: protectedProcedure.query(async ({ ctx }) => {
    const userPermissions = await getAllPermissions(
      ctx.redis,
      ctx.session,
      ctx.db,
      { userId: undefined },
    );

    const tags = await getAllTags(ctx.redis, ctx.db);

    const filteredTags = tags.filter((tag) => {
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
            getAllChildrenTags(p.entitiesTags, tags).includes(tag.name),
        )
      ) {
        return true;
      }
    });

    return filteredTags;
  }),
});
