import { Str } from "@supercharge/strings";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const shareableLinksRouter = createTRPCRouter({
  createLink: protectedProcedure
    .input(
      z.object({
        sharedEntityId: z.number().int(),
        expiration: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await ctx.db.links.create({
          data: {
            sharedEntityId: input.sharedEntityId,
            password: Str.random(24),
            expiration: input.expiration,
          },
        });

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
        const response = await ctx.db.links.findUnique({
          where: {
            id: input.id,
            sharedEntityId: input.sharedEntityId,
            password: input.password,
            expiration: {
              gte: new Date(),
            },
          },
        });

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
      const response = await ctx.db.links.findMany();

      return response;
    } catch (error) {
      console.error(error);
    }
  }),
  getLinksByEntityId: publicProcedure
    .input(z.object({ sharedEntityId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      try {
        const response = await ctx.db.links.findMany({
          where: {
            sharedEntityId: input.sharedEntityId,
            expiration: {
              gte: new Date(),
            },
          },
        });

        return response;
      } catch (error) {
        console.error(error);
      }
    }),
  removeLink: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.links.delete({
        where: {
          id: input.id,
        },
      });

      return response;
    }),
});
