import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import { getAllPermissions, getAllTags, logIO } from "~/lib/trpcFunctions";
import { tag } from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const tagsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const tags = await getAllTags(ctx.redis, ctx.db);
    return tags;
  }),
  addOne: protectedProcedure
    .input(z.object({ name: z.string(), parent: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [response] = await ctx.db
        .insert(tag)
        .values({
          name: input.name,
          parent: input.parent,
          color: input.color
        })
        .returning();

      if (!response) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tag couldn't be added",
        });
      }

      await logIO(ctx.dynamodb, ctx.user.id, "Añadir tag", input, response);

      await ctx.redis.del("tags");
      await ctx.redis.del("entities")

      return response;
    }),
  editOne: protectedProcedure.input(z.object({ oldName: z.string(), name: z.string().optional(), parent: z.string().optional(), color: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const [response] = await ctx.db.update(tag).set({ name: input.name, parent: input.parent, color: input.color }).where(eq(tag.name, input.oldName)).returning()

    if (!response) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tag couldn't be modified"
      })
    }

    await ctx.redis.del("tags")
    await ctx.redis.del("entities")

    return response
  }),
  removeOne: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [response] = await ctx.db
        .delete(tag)
        .where(eq(tag.name, input.name))
        .returning();

      if (!response) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tag was not found",
        });
      }

      await logIO(ctx.dynamodb, ctx.user.id, "Eliminar tag", input, response);

      await ctx.redis.del("tags");
      await ctx.redis.del("entities")

      return response;
    }),
  getFiltered: protectedProcedure.query(async ({ ctx }) => {
    const userPermissions = await getAllPermissions(
      ctx.redis,
      ctx.user,
      ctx.db,
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
