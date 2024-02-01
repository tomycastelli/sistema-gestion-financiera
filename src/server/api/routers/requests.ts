import { z } from "zod";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";

export const requestsRouter = createTRPCRouter({
  addOne: protectedLoggedProcedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const newRequest = await ctx.db.requests.create({
        data: {
          uploadedBy: ctx.session.user.id,
          title: input.title,
          content: input.content,
          status: "pending",
        },
      });

      return newRequest;
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
      const updatedRequest = await ctx.db.requests.update({
        where: {
          id: input.id,
        },
        data: {
          title: input.title,
          content: input.content,
        },
      });

      return updatedRequest;
    }),
  deleteOne: protectedLoggedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const deletedRequest = await ctx.db.requests.delete({
        where: {
          id: input.id,
        },
      });

      return deletedRequest;
    }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const allRequests = await ctx.db.requests.findMany({
      include: { uploadedByUser: { select: { name: true } } },
    });

    return allRequests;
  }),
});
