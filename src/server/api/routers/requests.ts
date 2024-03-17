import { eq } from "drizzle-orm";
import { z } from "zod";
import { requests } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";

export const requestsRouter = createTRPCRouter({
  addOne: protectedLoggedProcedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db
        .insert(requests)
        .values({
          uploadedBy: ctx.user.id,
          title: input.title,
          content: input.content,
          status: "pending",
        })
        .returning();

      return response;
    }),
  updateOne: protectedLoggedProcedure
    .input(
      z.object({
        id: z.number().int(),
        title: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [response] = await ctx.db
        .update(requests)
        .set({
          title: input.title,
          content: input.content,
        })
        .where(eq(requests.id, input.id))
        .returning();

      return response;
    }),
  deleteOne: protectedLoggedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db
        .delete(requests)
        .where(eq(requests.id, input.id))
        .returning();

      return response;
    }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.query.requests.findMany({
      with: {
        uploadedByUser: {
          columns: {
            name: true,
          },
        },
      },
    });

    return response;
  }),
});
