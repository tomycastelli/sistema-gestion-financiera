import { Str } from "@supercharge/strings";
import { TRPCError } from "@trpc/server";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { links } from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const shareableLinksRouter = createTRPCRouter({
  createLink: protectedProcedure
    .input(
      z.object({
        sharedEntityId: z.number().int(),
        expiration: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [response] = await ctx.db
          .insert(links)
          .values({
            sharedEntityId: input.sharedEntityId,
            password: Str.random(24),
            expiration: input.expiration,
          })
          .returning();

        return response;
      } catch (error) {
        console.error(error);
      }
    }),

  validateLink: publicProcedure
    .input(
      z.object({
        id: z.number().int(),
        sharedEntityId: z.number().int(),
        password: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const [response] = await ctx.db
          .select()
          .from(links)
          .where(
            and(
              eq(links.id, input.id),
              eq(links.sharedEntityId, input.sharedEntityId),
              eq(links.password, input.password),
              gte(links.expiration, new Date()),
            ),
          )
          .limit(1);

        if (response) {
          return response;
        } else {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No se pudo verificar el link",
          });
        }
      } catch (error) {
        console.error(error);
      }
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    try {
      const response = await ctx.db.select().from(links);

      return response;
    } catch (error) {
      console.error(error);
    }
  }),
  getLinksByEntityId: publicProcedure
    .input(z.object({ sharedEntityId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      try {
        const response = await ctx.db
          .select()
          .from(links)
          .where(
            and(
              eq(links.sharedEntityId, input.sharedEntityId),
              gte(links.expiration, new Date()),
            ),
          );

        return response;
      } catch (error) {
        console.error(error);
      }
    }),
  removeLink: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [response] = await ctx.db
        .delete(links)
        .where(eq(links.id, input.id))
        .returning();

      return response;
    }),
});
