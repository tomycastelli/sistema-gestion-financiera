import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import {
  getGlobalSettings,
  globalSettingSchema,
  settingEnum,
} from "~/lib/trpcFunctions";
import { globalSettings } from "~/server/db/schema";
import { env } from "~/env.mjs";

export const globalSettingsRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.select().from(globalSettings);

    const foundPeriod = response.find((obj) => obj.name === "accountingPeriod");
    const foundMainTag = response.find((obj) => obj.name === "mainTag");

    if (!foundPeriod) {
      response.push({
        name: "accountingPeriod",
        data: { months: 1, graceDays: 10 },
      });
    }
    if (!foundMainTag) {
      response.push({
        name: "mainTag",
        data: { tag: env.NEXT_PUBLIC_MAIN_NAME },
      });
    }

    const parsedResponse = globalSettingSchema.array().safeParse(response);

    if (!parsedResponse.success) {
      throw new TRPCError({
        code: "PARSE_ERROR",
        message: parsedResponse.error.message,
      });
    }

    return parsedResponse.data;
  }),
  get: publicProcedure
    .input(z.object({ name: settingEnum }))
    .query(async ({ ctx, input }) => {
      const response = await getGlobalSettings(ctx.redis, ctx.db, input.name);

      return response;
    }),
  set: protectedProcedure
    .input(globalSettingSchema)
    .mutation(async ({ ctx, input }) => {
      const [response] = await ctx.db
        .insert(globalSettings)
        .values(input)
        .onConflictDoUpdate({
          target: globalSettings.name,
          set: { data: input.data },
        })
        .returning();

      if (response) {
        await ctx.redis.del(`globalSetting|${response.name}`);
      }

      return response;
    }),
});
