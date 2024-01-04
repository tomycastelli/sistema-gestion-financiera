import { z } from "zod";
import { type LogsDocument } from "~/server/mongodb";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const logsRouter = createTRPCRouter({
  getLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().int(),
        page: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const allLogs: LogsDocument[] | undefined = await ctx.logs
        // @ts-ignore
        .find({})
        .sort({ timestamp: -1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit);

      const count = await ctx.logs.countDocuments();

      return { logs: allLogs, count: count };
    }),
});
